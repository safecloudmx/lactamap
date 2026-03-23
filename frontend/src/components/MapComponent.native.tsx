import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { MapPin, Baby, Star, Users } from 'lucide-react-native';
import { Lactario } from '../types';
import { ZoomTarget } from './MapComponent.web';
import { colors } from '../theme';
import PulsingLocationMarker from './map/PulsingLocationMarker';

let Location: any = null;
try {
  Location = require('expo-location');
} catch (_) {}

interface MapComponentProps {
  lactarios?: Lactario[];
  onSelectRoom?: (lactario: Lactario) => void;
  zoomTarget?: ZoomTarget | null;
}

const DEFAULT_REGION: Region = {
  latitude: 25.6866,
  longitude: -100.3161,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const PIN_COLORS: Record<string, string> = {
  LACTARIO: '#f43f5e',
  CAMBIADOR: '#8b5cf6',
  BANO_FAMILIAR: '#0d9488',
  PUNTO_INTERES: '#f59e0b',
};

const PinIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'CAMBIADOR': return <Baby size={14} color={colors.white} />;
    case 'BANO_FAMILIAR': return <Users size={14} color={colors.white} />;
    case 'PUNTO_INTERES': return <Star size={14} color={colors.white} />;
    default: return <MapPin size={14} color={colors.white} />;
  }
};

export default function MapComponent({ lactarios = [], onSelectRoom, zoomTarget }: MapComponentProps) {
  const mapRef = useRef<MapView | null>(null);
  const [initialRegion, setInitialRegion] = useState<Region>(DEFAULT_REGION);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (!zoomTarget || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude: zoomTarget.lat,
      longitude: zoomTarget.lng,
      latitudeDelta: zoomTarget.zoom ? 0.01 / zoomTarget.zoom * 13 : 0.05,
      longitudeDelta: zoomTarget.zoom ? 0.01 / zoomTarget.zoom * 13 : 0.05,
    }, 800);
  }, [zoomTarget]);

  useEffect(() => {
    if (!Location) return;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);
      setInitialRegion({
        ...coords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    })();
  }, []);

  return (
    <MapView
      ref={mapRef}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      style={styles.map}
      initialRegion={initialRegion}
      showsUserLocation={false}
      showsMyLocationButton={false}
      onPress={() => onSelectRoom && onSelectRoom(null as any)}
    >
      {userLocation && (
        <PulsingLocationMarker coordinate={userLocation} />
      )}

      {lactarios.map((lactario) => {
        const pt = lactario.placeType || 'LACTARIO';
        const pinColor = PIN_COLORS[pt] || PIN_COLORS.LACTARIO;
        return (
          <Marker
            key={lactario.id}
            coordinate={{
              latitude: Number(lactario.latitude),
              longitude: Number(lactario.longitude),
            }}
            onPress={() => onSelectRoom && onSelectRoom(lactario)}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.customPin}>
              <View style={[styles.pinHead, { backgroundColor: pinColor }]}>
                <PinIcon type={pt} />
              </View>
              <View style={[styles.pinTail, { borderTopColor: pinColor }]} />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
  customPin: {
    alignItems: 'center',
  },
  pinHead: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});
