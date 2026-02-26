import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Lactario } from '../types';
import { colors, spacing, typography, radii, shadows } from '../theme';

interface MapComponentProps {
  lactarios?: Lactario[];
  onSelectRoom?: (lactario: Lactario) => void;
}

export default function MapComponent({ lactarios = [], onSelectRoom }: MapComponentProps) {
  const mapHtml = useMemo(() => {
    const markers = lactarios
      .filter((l) => l.latitude && l.longitude)
      .map(
        (l) =>
          `L.marker([${l.latitude}, ${l.longitude}])` +
          `.addTo(map)` +
          `.bindPopup('<b>${l.name.replace(/'/g, "\\'")}</b><br>${(l.address || '').replace(/'/g, "\\'")}')` +
          `.on('click', function(){ window.parent.postMessage({ type:'selectLactario', id:'${l.id}' }, '*'); });`
      )
      .join('\n');

    const center = lactarios.length > 0 && lactarios[0].latitude
      ? `[${lactarios[0].latitude}, ${lactarios[0].longitude}]`
      : '[25.6866, -100.3161]';

    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
  html, body, #map { margin:0; padding:0; width:100%; height:100%; }
</style>
</head><body>
<div id="map"></div>
<script>
  var map = L.map('map').setView(${center}, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);
  ${markers}
<\/script>
</body></html>`;
  }, [lactarios]);

  React.useEffect(() => {
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
          srcDoc={mapHtml}
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
  container: {
    flex: 1,
    position: 'relative',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  fallbackText: {
    ...typography.body,
    color: colors.slate[400],
  },
  countBadge: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    ...shadows.md,
  },
  countText: {
    ...typography.captionBold,
    color: colors.white,
  },
});
