import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Lactario } from '../types';
import { colors, spacing, typography, radii, shadows } from '../theme';

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

export default function MapComponent({ lactarios = [], onSelectRoom, zoomTarget }: MapComponentProps) {
  const iframeRef = useRef<any>(null);

  // Post zoom command to Leaflet inside the iframe
  useEffect(() => {
    if (!zoomTarget || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: 'zoomTo', lat: zoomTarget.lat, lng: zoomTarget.lng, zoom: zoomTarget.zoom ?? 14 },
      '*'
    );
  }, [zoomTarget]);

  const mapHtml = useMemo(() => {
    const markers = lactarios
      .filter((l) => l.latitude && l.longitude)
      .map((l) => {
        const isCambiador = l.placeType === 'CAMBIADOR';
        const pinColor = isCambiador ? '#8b5cf6' : '#f43f5e';
        const tailColor = isCambiador ? '#8b5cf6' : '#f43f5e';
        // Lactario: breastfeeding silhouette. Cambiador: diaper shape.
        const iconSvg = isCambiador
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20.5 4.5h-17A1.5 1.5 0 002 6v3.5c2.5.8 4.5 1.5 4.5 1.5s-2 .7-4.5 1.5V18a1.5 1.5 0 001.5 1.5h17A1.5 1.5 0 0022 18v-5.5c-2.5-.8-4.5-1.5-4.5-1.5s2-.7 4.5-1.5V6a1.5 1.5 0 00-1.5-1.5z"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7 7-7z"/></svg>`;
        return (
          `(function(){` +
          `var el=document.createElement('div');` +
          `el.className='custom-pin';` +
          `el.innerHTML='<div class="pin-head" style="background:${pinColor}">${iconSvg}</div><div class="pin-tail" style="border-top-color:${tailColor}"></div>';` +
          `var icon=L.divIcon({className:'',html:el.outerHTML,iconSize:[32,42],iconAnchor:[16,42],popupAnchor:[0,-48]});` +
          `var popupContent='<div style="font-family:sans-serif;min-width:200px;border-radius:10px;overflow:hidden;margin:-1px">'+` +
          (l.imageUrl ? `'<img src="${l.imageUrl}" style="width:100%;height:110px;object-fit:cover;display:block" />'+` : `''`) +
          `'<div style="padding:10px 12px 4px">'+` +
          `'<span style="font-size:11px;background:${isCambiador ? '#ede9fe' : '#fff1f2'};color:${isCambiador ? '#7c3aed' : '#e11d48'};padding:2px 8px;border-radius:99px;font-weight:700">${isCambiador ? '🚼 Cambiador' : '🤱 Lactario'}</span>'+` +
          `'<div style="font-weight:700;margin-top:5px;font-size:14px">${l.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}</div>'+` +
          `'<div style="color:#64748b;font-size:12px;margin-top:2px;margin-bottom:6px">${(l.address || '').replace(/'/g, "\\'").replace(/"/g, '&quot;')}</div>'+` +
          `'</div>'+` +
          `'</div>';` +
          `L.marker([${l.latitude},${l.longitude}],{icon:icon}).addTo(map)` +
          `.bindPopup(popupContent,{offset:[0,0]})` +
          `.on('click',function(){window.parent.postMessage({type:'selectLactario',id:'${l.id}'},'*');});` +
          `})()`
        );
      })
      .join('\n');

    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
  html, body, #map { margin:0; padding:0; width:100%; height:100%; }
  .pin-head {
    width:32px; height:32px; border-radius:50%;
    border:2.5px solid #fff;
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 2px 6px rgba(0,0,0,0.25);
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

  ${markers}

  // Listen for commands from the React parent (zoom, etc.)
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'zoomTo') {
      map.setView([e.data.lat, e.data.lng], e.data.zoom || 14);
    }
  });

  // Request user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        map.setView([lat, lng], 16);
        var userIcon = L.divIcon({
          className: '',
          html: '<div class="user-location-wrap"><div class="user-pulse"></div><div class="user-dot"></div></div>',
          iconSize: [60, 60],
          iconAnchor: [30, 30]
        });
        L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
      },
      function(err) { console.warn('Geolocation:', err.message); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }
<\/script>
</body></html>`;
  }, [lactarios]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'selectLactario' && onSelectRoom) {
        const found = lactarios.find((l) => l.id === event.data.id);
        if (found) onSelectRoom(found);
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
          allow="geolocation"
          style={{ width: '100%', height: '100%', border: 'none' } as any}
          title="LactaMap"
        />
      ) : (
        <View style={styles.fallback}>
          <MapPin size={48} color={colors.slate[300]} />
          <Text style={styles.fallbackText}>Mapa no disponible</Text>
        </View>
      )}

      {lactarios.length > 0 && (
        <View style={styles.countBadge}>
          <MapPin size={14} color={colors.white} />
          <Text style={styles.countText}>{lactarios.length} lactarios</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  fallbackText: { ...typography.body, color: colors.slate[400] },
  countBadge: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.full, ...shadows.md,
  },
  countText: { ...typography.captionBold, color: colors.white },
});
