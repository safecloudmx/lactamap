import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Lactario } from '../types';
import { colors, spacing, shadows, radii, typography } from '../theme';

export interface ZoomTarget {
  lat: number;
  lng: number;
  zoom?: number;
}

interface MapComponentProps {
  lactarios?: Lactario[];
  onSelectRoom?: (lactario: Lactario) => void;
  zoomTarget?: ZoomTarget | null;
}

type FilterKey = 'LACTARIO' | 'CAMBIADOR' | 'BANO_FAMILIAR' | 'PUNTO_INTERES';

const FILTER_ITEMS: { key: FilterKey; emoji: string; color: string }[] = [
  { key: 'LACTARIO',      emoji: '🤱', color: '#f43f5e' },
  { key: 'CAMBIADOR',     emoji: '🚼', color: '#8b5cf6' },
  { key: 'BANO_FAMILIAR', emoji: '🚻', color: '#0d9488' },
  { key: 'PUNTO_INTERES', emoji: '⭐', color: '#f59e0b' },
];

const ALL_ACTIVE: Record<FilterKey, boolean> = {
  LACTARIO: true, CAMBIADOR: true, BANO_FAMILIAR: true, PUNTO_INTERES: true,
};

let Location: any = null;
try { Location = require('expo-location'); } catch (_) {}

export default function MapComponent({ lactarios = [], onSelectRoom, zoomTarget }: MapComponentProps) {
  const iframeRef = useRef<any>(null);
  const [visibleCounts, setVisibleCounts] = useState<Record<FilterKey, number>>({
    LACTARIO: 0, CAMBIADOR: 0, BANO_FAMILIAR: 0, PUNTO_INTERES: 0,
  });
  const [activeFilters, setActiveFilters] = useState<Record<FilterKey, boolean>>(ALL_ACTIVE);
  const activeFiltersRef = useRef(activeFilters);
  const userLocationSent = useRef(false);

  useEffect(() => { activeFiltersRef.current = activeFilters; }, [activeFilters]);

  // Get user location from parent context and send to iframe
  useEffect(() => {
    if (userLocationSent.current) return;
    (async () => {
      try {
        let lat: number | null = null;
        let lng: number | null = null;
        if (Location) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            lat = loc.coords.latitude;
            lng = loc.coords.longitude;
          }
        } else if (navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false, timeout: 15000, maximumAge: 60000,
            })
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
        if (lat !== null && lng !== null) {
          userLocationSent.current = true;
          // Wait for iframe to be ready, then send location
          const sendLocation = () => {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'userLocation', lat, lng }, '*'
            );
          };
          // Send immediately and also after a delay (iframe might not be ready)
          sendLocation();
          setTimeout(sendLocation, 1500);
          setTimeout(sendLocation, 3000);
        }
      } catch (_) {}
    })();
  }, [lactarios]);

  useEffect(() => {
    if (!zoomTarget || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: 'zoomTo', lat: zoomTarget.lat, lng: zoomTarget.lng, zoom: zoomTarget.zoom ?? 14 },
      '*'
    );
  }, [zoomTarget]);

  const handleFilterToggle = useCallback((key: FilterKey) => {
    setActiveFilters(prev => {
      const next = { ...prev, [key]: !prev[key] };
      iframeRef.current?.contentWindow?.postMessage({ type: 'filterTypes', active: next }, '*');
      return next;
    });
  }, []);

  const mapHtml = useMemo(() => {
    const PIN_COLORS: Record<string, string> = {
      LACTARIO: '#f43f5e',
      CAMBIADOR: '#8b5cf6',
      BANO_FAMILIAR: '#0d9488',
      PUNTO_INTERES: '#f59e0b',
    };
    const PIN_ICONS: Record<string, string> = {
      LACTARIO: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7 7-7z"/></svg>`,
      CAMBIADOR: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20.5 4.5h-17A1.5 1.5 0 002 6v3.5c2.5.8 4.5 1.5 4.5 1.5s-2 .7-4.5 1.5V18a1.5 1.5 0 001.5 1.5h17A1.5 1.5 0 0022 18v-5.5c-2.5-.8-4.5-1.5-4.5-1.5s2-.7 4.5-1.5V6a1.5 1.5 0 00-1.5-1.5z"/></svg>`,
      BANO_FAMILIAR: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M9 2a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zM6 8v5h2v9h2v-5h2v5h2V13h2V8H6zm7 0v2h2V8h-2z"/></svg>`,
      PUNTO_INTERES: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    };

    const markers = lactarios
      .filter((l) => l.latitude && l.longitude)
      .map((l) => {
        const pt = l.placeType || 'LACTARIO';
        const pinColor = PIN_COLORS[pt] || '#f43f5e';
        const iconSvg = PIN_ICONS[pt] || PIN_ICONS.LACTARIO;
        const badgeBg = pt === 'CAMBIADOR' ? '#ede9fe' : pt === 'BANO_FAMILIAR' ? '#ccfbf1' : pt === 'PUNTO_INTERES' ? '#fef3c7' : '#fff1f2';
        const badgeColor = pt === 'CAMBIADOR' ? '#7c3aed' : pt === 'BANO_FAMILIAR' ? '#0f766e' : pt === 'PUNTO_INTERES' ? '#d97706' : '#e11d48';
        const badgeLabel = pt === 'CAMBIADOR' ? '🚼 Cambiador' : pt === 'BANO_FAMILIAR' ? '🚻 Baño Familiar' : pt === 'PUNTO_INTERES' ? '⭐ Punto de Interés' : '🤱 Lactario';
        const priv = l.isPrivate === true;
        const pinClass = priv ? 'custom-pin pin-private' : 'custom-pin';
        const privateBadge = priv
          ? `'<span style="font-size:11px;background:#eef2ff;color:#4338ca;padding:2px 8px;border-radius:99px;font-weight:700;margin-left:4px">🔒 Acceso Restringido</span>'+`
          : '';
        return (
          `(function(){` +
          `var el=document.createElement('div');` +
          `el.className='${pinClass}';` +
          `el.innerHTML='<div class="pin-head" style="background:${pinColor}">${iconSvg}</div><div class="pin-tail" style="border-top-color:${pinColor}"></div>';` +
          `var icon=L.divIcon({className:'',html:el.outerHTML,iconSize:[32,42],iconAnchor:[16,42],popupAnchor:[0,-48]});` +
          `var popupContent='<div style="font-family:sans-serif;min-width:200px;border-radius:10px;overflow:hidden;margin:-1px">'+` +
          (l.imageUrl ? `'<img src="${l.imageUrl}" style="width:100%;height:110px;object-fit:cover;display:block" />'+` : ``) +
          `'<div style="padding:10px 12px 4px">'+` +
          `'<span style="font-size:11px;background:${badgeBg};color:${badgeColor};padding:2px 8px;border-radius:99px;font-weight:700">${badgeLabel}</span>'+` +
          privateBadge +
          `'<div style="font-weight:700;margin-top:5px;font-size:14px">${l.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}</div>'+` +
          `'<div style="color:#64748b;font-size:12px;margin-top:2px;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${(l.description || '').replace(/'/g, "\\'").replace(/"/g, '&quot;')}</div>'+` +
          `'</div>'+` +
          `'</div>';` +
          `var m=L.marker([${l.latitude},${l.longitude}],{icon:icon})` +
          `.bindPopup(popupContent,{offset:[0,0]})` +
          `.on('click',function(){window.parent.postMessage({type:'selectLactario',id:'${l.id}'},'*');});` +
          `allMarkerObjects.push({type:'${pt}',marker:m});` +
          `markerCluster.addLayer(m);` +
          `})()`
        );
      })
      .join(';\n');

    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"><\/script>
<style>
  html, body, #map { margin:0; padding:0; width:100%; height:100%; }
  .pin-head {
    width:32px; height:32px; border-radius:50%;
    border:2.5px solid #fff;
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 2px 6px rgba(0,0,0,0.25);
  }
  .pin-private .pin-head {
    border:2.5px dotted #000000;
    box-shadow:0 2px 8px rgba(0,0,0,0.4);
  }
  .pin-tail {
    width:0; height:0; margin:0 auto;
    border-left:6px solid transparent;
    border-right:6px solid transparent;
    border-top-width:8px; border-top-style:solid;
    margin-top:-2px;
  }
  .leaflet-popup-content { margin: 0 !important; padding: 0 !important; }
  .leaflet-popup-content-wrapper { padding: 0 !important; border-radius: 12px !important; overflow: hidden; }
  .leaflet-control-attribution a { pointer-events: none; cursor: default; }
  .user-location-wrap {
    position:relative; width:60px; height:60px;
    display:flex; align-items:center; justify-content:center;
  }
  .user-pulse {
    position:absolute; border-radius:50%;
    background:rgba(59,130,246,0.35);
    width:60px; height:60px;
    animation:upulse 2s ease-out infinite;
  }
  .user-dot {
    width:18px; height:18px; border-radius:50%;
    background:#3B82F6; border:3px solid #fff;
    box-shadow:0 2px 6px rgba(0,0,0,0.3);
    position:relative; z-index:2;
  }
  @keyframes upulse {
    0%  { transform:scale(0.3); opacity:0.7; }
    100%{ transform:scale(1);   opacity:0;   }
  }
  .lactamap-cluster {
    background:#f43f5e; border:3px solid #fff; border-radius:50%;
    color:#fff; font-weight:700; font-family:sans-serif;
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 2px 10px rgba(0,0,0,0.35);
  }
  .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large { background:transparent !important; }
  .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div { background:transparent !important; }
</style>
</head><body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false }).setView([25.6866, -100.3161], 13);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  var allMarkerObjects = [];
  var _activeFilters = { LACTARIO: true, CAMBIADOR: true, BANO_FAMILIAR: true, PUNTO_INTERES: true };

  var markerCluster = L.markerClusterGroup({
    iconCreateFunction: function(cluster) {
      var n = cluster.getChildCount();
      var sz = n < 10 ? 36 : n < 100 ? 44 : 52;
      var fs = n < 10 ? 13 : 15;
      return L.divIcon({
        html: '<div class="lactamap-cluster" style="width:'+sz+'px;height:'+sz+'px;font-size:'+fs+'px">'+n+'</div>',
        className: '', iconSize: [sz, sz], iconAnchor: [sz/2, sz/2]
      });
    },
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true
  });
  markerCluster.addTo(map);

  ${markers}

  var _allMarkers = [${lactarios.filter(l => l.latitude && l.longitude).map(l => `[${l.latitude},${l.longitude},'${l.placeType || 'LACTARIO'}']`).join(',')}];
  function _updateCount() {
    var b = map.getBounds();
    var counts = { LACTARIO: 0, CAMBIADOR: 0, BANO_FAMILIAR: 0, PUNTO_INTERES: 0 };
    _allMarkers.forEach(function(m) {
      if (_activeFilters[m[2]] && b.contains([m[0], m[1]])) { counts[m[2]] = (counts[m[2]]||0)+1; }
    });
    window.parent.postMessage({ type: 'visibleCounts', counts: counts }, '*');
  }
  map.on('moveend', _updateCount);
  map.on('zoomend', _updateCount);
  setTimeout(_updateCount, 800);

  var _userMarkerAdded = false;
  function _addUserMarker(lat, lng) {
    if (_userMarkerAdded) return;
    _userMarkerAdded = true;
    map.setView([lat, lng], 16);
    var userIcon = L.divIcon({
      className: '',
      html: '<div class="user-location-wrap"><div class="user-pulse"></div><div class="user-dot"></div></div>',
      iconSize: [60, 60], iconAnchor: [30, 30]
    });
    L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
  }

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'zoomTo') { map.setView([e.data.lat, e.data.lng], e.data.zoom||14); }
    if (e.data.type === 'recount') { _updateCount(); }
    if (e.data.type === 'userLocation') { _addUserMarker(e.data.lat, e.data.lng); }
    if (e.data.type === 'filterTypes') {
      _activeFilters = e.data.active;
      markerCluster.clearLayers();
      allMarkerObjects.forEach(function(m) {
        if (_activeFilters[m.type]) { markerCluster.addLayer(m.marker); }
      });
      _updateCount();
    }
  });
<\/script>
</body></html>`;
  }, [lactarios]);

  useEffect(() => {
    const counts = { LACTARIO: 0, CAMBIADOR: 0, BANO_FAMILIAR: 0, PUNTO_INTERES: 0 } as Record<string, number>;
    lactarios.forEach((l) => {
      const t = l.placeType || 'LACTARIO';
      counts[t] = (counts[t] || 0) + 1;
    });
    setVisibleCounts(counts as any);

    const timer = setTimeout(() => {
      const af = activeFiltersRef.current;
      iframeRef.current?.contentWindow?.postMessage({ type: 'recount' }, '*');
      iframeRef.current?.contentWindow?.postMessage({ type: 'filterTypes', active: af }, '*');
    }, 1000);
    return () => clearTimeout(timer);
  }, [lactarios]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'selectLactario' && onSelectRoom) {
        const found = lactarios.find((l) => l.id === event.data.id);
        if (found) onSelectRoom(found);
      }
      if (event.data?.type === 'visibleCounts') {
        setVisibleCounts(event.data.counts);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [lactarios, onSelectRoom]);

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          srcDoc={mapHtml}
          allow="geolocation *"
          style={{ width: '100%', height: '100%', border: 'none' } as any}
          title="LactaMap"
        />
      ) : (
        <View style={styles.fallback}>
          <MapPin size={48} color={colors.slate[300]} />
          <Text style={styles.fallbackText}>Mapa no disponible</Text>
        </View>
      )}

      <View pointerEvents="box-none" style={styles.filterBarWrapper}>
        <View style={styles.filterBar}>
          {FILTER_ITEMS.map((item, i, arr) => (
            <React.Fragment key={item.key}>
              <TouchableOpacity
                style={styles.filterChip}
                onPress={() => handleFilterToggle(item.key)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.filterCheckbox,
                  activeFilters[item.key] && { backgroundColor: item.color, borderColor: item.color },
                ]}>
                  {activeFilters[item.key] && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.chipEmoji, !activeFilters[item.key] && styles.dimmed]}>
                  {item.emoji}
                </Text>
                <Text style={[styles.chipCount, { color: activeFilters[item.key] ? item.color : colors.slate[300] }]}>
                  {visibleCounts[item.key] || 0}
                </Text>
              </TouchableOpacity>
              {i < arr.length - 1 && <View style={styles.separator} />}
            </React.Fragment>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  fallbackText: { ...typography.body, color: colors.slate[400] },
  filterBarWrapper: {
    position: 'absolute',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.97)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.full,
    ...shadows.md,
    gap: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderRadius: radii.sm,
  },
  filterCheckbox: {
    width: 15,
    height: 15,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.slate[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
  dimmed: { opacity: 0.35 },
  chipEmoji: { fontSize: 13 },
  chipCount: { fontSize: 13, fontWeight: '700' },
  separator: {
    width: 1,
    height: 16,
    backgroundColor: colors.slate[200],
  },
});
