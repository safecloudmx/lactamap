import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert, StyleSheet, Modal,
  ActionSheetIOS, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera, Check, ImagePlus, AlertTriangle, Plus, X, MapPin, Lock, Info } from 'lucide-react-native';
import { Amenity, GenderAccess } from '../types';
import { AMENITY_LABELS } from '../constants';
import { createLactario, uploadPhoto } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { AppHeader, Chip, LoadingOverlay } from '../components/ui';

let Location: any = null;
try { Location = require('expo-location'); } catch (_) {}

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

let RNMaps: any = null;
try { RNMaps = require('react-native-maps'); } catch (_) {}

const ADMIN_ROLES = ['ADMIN', 'ELITE'];

// Changer-specific specifications (separate from lactario amenities)
const CHANGER_SPECS = ['Dentro de un Baño', 'Abierto', 'Privado', 'Lavabo', 'Climatizado'];
const BATHROOM_SPECS = ['Lavabo', 'Cambiador', 'Climatizado', 'Accesible', 'Privado', 'Abierto'];
const POI_TYPES = ['Parque', 'Restaurante', 'Zona de Juegos', 'Cine', 'Centro Comercial', 'Cafetería', 'Farmacia', 'Museo', 'Biblioteca', 'Área Deportiva'];

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'es' } }
    );
    const data = await res.json();
    return data?.display_name || null;
  } catch {}
  return null;
}

function buildMapPickerHtml(lat: number, lng: number) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}
#hint{position:absolute;top:10px;left:50%;transform:translateX(-50%);
  background:rgba(255,255,255,0.92);padding:6px 14px;border-radius:20px;
  font-family:sans-serif;font-size:13px;color:#334155;z-index:999;
  box-shadow:0 2px 8px rgba(0,0,0,0.15);pointer-events:none;white-space:nowrap;}</style>
</head><body>
<div id="hint">Toca el mapa para colocar el marcador</div>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false}).setView([${lat},${lng}],15);
L.control.zoom({position:'bottomright'}).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap',maxZoom:19}).addTo(map);
var marker=L.marker([${lat},${lng}],{draggable:true}).addTo(map);
function notify(ll){window.parent.postMessage({type:'pinMoved',lat:ll.lat,lng:ll.lng},'*');}
notify(marker.getLatLng());
marker.on('dragend',function(){notify(marker.getLatLng());});
map.on('click',function(e){marker.setLatLng(e.latlng);notify(e.latlng);});
<\/script></body></html>`;
}

type PlaceType = 'LACTARIO' | 'CAMBIADOR' | 'BANO_FAMILIAR' | 'PUNTO_INTERES';

export default function AddRoomScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isPrivileged = ADMIN_ROLES.includes(user?.role ?? '');

  const [placeType, setPlaceType] = useState<PlaceType | null>(null);
  const [establishmentName, setEstablishmentName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [accessSelection, setAccessSelection] = useState<string[]>([GenderAccess.NEUTRAL]);
  const [selectedAmenities, setSelectedAmenities] = useState<Amenity[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [selectedBathroomSpecs, setSelectedBathroomSpecs] = useState<string[]>([]);
  const [selectedPoiTypes, setSelectedPoiTypes] = useState<string[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [showPrivateInfo, setShowPrivateInfo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [currentLocation, setCurrentLocation] = useState({ latitude: 25.6866, longitude: -100.3161 });
  const [pickedLocation, setPickedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickerCoords, setPickerCoords] = useState({ latitude: 25.6866, longitude: -100.3161 });
  const [mapPickerHtml, setMapPickerHtml] = useState('');
  const mapPickerIframeRef = useRef<any>(null);
  const fileInputRef = useRef<any>(null);

  const effectiveLocation = pickedLocation ?? currentLocation;

  // Build display name from the two fields
  const compositeName = locationName.trim()
    ? `${establishmentName.trim()} — ${locationName.trim()}`
    : establishmentName.trim();

  // Gender access toggle logic
  const isAccessLocked = placeType === 'BANO_FAMILIAR' || placeType === 'LACTARIO';
  const isSingleSelect = placeType === 'PUNTO_INTERES';
  const handleAccessToggle = (value: string) => {
    if (isAccessLocked) return;
    if (isSingleSelect) {
      setAccessSelection([value]);
      return;
    }
    if (value === GenderAccess.NEUTRAL) {
      setAccessSelection([GenderAccess.NEUTRAL]);
    } else {
      setAccessSelection((prev) => {
        const withoutNeutral = prev.filter((v) => v !== GenderAccess.NEUTRAL);
        if (withoutNeutral.includes(value)) {
          const result = withoutNeutral.filter((v) => v !== value);
          return result.length === 0 ? [GenderAccess.NEUTRAL] : result;
        }
        return [...withoutNeutral, value];
      });
    }
  };

  // Force access based on placeType
  const handlePlaceTypeChange = (type: PlaceType) => {
    setPlaceType(type);
    if (type === 'LACTARIO') {
      setAccessSelection([GenderAccess.WOMEN]);
    } else if (type === 'BANO_FAMILIAR') {
      setAccessSelection([GenderAccess.NEUTRAL]);
    }
  };

  // Derive the genderAccess string to send to backend
  const genderAccessValue = accessSelection.sort().join(', ');

  useEffect(() => {
    if (!Location) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setCurrentLocation(coords);
      setPickerCoords(coords);
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'pinMoved') {
        setPickerCoords({ latitude: event.data.lat, longitude: event.data.lng });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Photo picker
  const pickFromGalleryNative = async () => {
    if (!ImagePicker) { Alert.alert('No disponible', 'Ejecuta: npx expo install expo-image-picker'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Se necesita acceso a la galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const takePhotoNative = async () => {
    if (!ImagePicker) { Alert.alert('No disponible', 'Ejecuta: npx expo install expo-image-picker'); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const handleImagePick = () => {
    if (Platform.OS === 'web') { fileInputRef.current?.click(); return; }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancelar', 'Tomar foto', 'Elegir de galería'], cancelButtonIndex: 0 },
        (i) => { if (i === 1) takePhotoNative(); else if (i === 2) pickFromGalleryNative(); }
      );
    } else {
      Alert.alert('Agregar foto', 'Elige una opción', [
        { text: 'Tomar foto', onPress: takePhotoNative },
        { text: 'Elegir de galería', onPress: pickFromGalleryNative },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  };

  // Tags
  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  // Private location toggle — always show modal when enabling
  const handlePrivateToggle = () => {
    if (!isPrivate) {
      setShowPrivateInfo(true);
    } else {
      setIsPrivate(false);
    }
  };
  const handlePrivateConfirm = () => {
    setIsPrivate(true);
    setShowPrivateInfo(false);
  };

  // Map picker
  const handleMapPickerConfirm = async () => {
    setPickedLocation(pickerCoords);
    setShowMapPicker(false);
    const addr = await reverseGeocode(pickerCoords.latitude, pickerCoords.longitude);
    if (addr) setAddress(addr);
  };

  // Save
  const canSave = placeType !== null && establishmentName.trim().length >= 3 && locationName.trim().length >= 2;

  const handleSavePress = () => {
    if (!canSave) return;
    setShowConsent(true);
  };

  const handleConsentConfirm = async () => {
    setShowConsent(false);
    setIsSaving(true);
    try {
      const amenities =
        placeType === 'CAMBIADOR' ? selectedSpecs :
        placeType === 'BANO_FAMILIAR' ? selectedBathroomSpecs :
        placeType === 'PUNTO_INTERES' ? [] :
        selectedAmenities.map(String);
      const finalTags = placeType === 'PUNTO_INTERES'
        ? [...tags, ...selectedPoiTypes]
        : tags;
      const result = await createLactario({
        name: compositeName,
        latitude: effectiveLocation.latitude,
        longitude: effectiveLocation.longitude,
        address: address.trim() || undefined,
        description: description.trim(),
        amenities,
        tags: finalTags,
        placeType: placeType!,
        genderAccess: genderAccessValue,
        isPrivate,
      });

      // Upload photo if user selected one
      if (imageUri && result?.id) {
        try {
          await uploadPhoto(result.id, imageUri);
        } catch {
          // Photo upload failed silently — room was created, user can add photo later
        }
      }

      if (Platform.OS === 'web') {
        navigation.goBack();
        Alert.alert(
          result.requiresReview ? 'Solicitud enviada' : 'Ubicación agregada',
          result.requiresReview
            ? 'Tu aporte fue enviado y será publicado tras ser aprobado por un moderador.'
            : 'El lugar fue publicado exitosamente.'
        );
      } else {
        Alert.alert(
          result.requiresReview ? 'Enviado para revisión' : '¡Publicado!',
          result.requiresReview
            ? 'Tu aporte fue enviado y será publicado tras ser aprobado por un moderador.'
            : 'El lugar fue publicado exitosamente.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAmenity = (amenity: Amenity) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    );
  };

  const toggleSpec = (spec: string) => {
    setSelectedSpecs((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  };

  const toggleBathroomSpec = (spec: string) => {
    setSelectedBathroomSpecs((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  };
  const togglePoiType = (t: string) => {
    setSelectedPoiTypes((prev) =>
      prev.includes(t) ? prev.filter((s) => s !== t) : [...prev, t]
    );
  };

  const MapViewComp = RNMaps?.default;
  const RNMarker = RNMaps?.Marker;

  return (
    <View style={styles.container}>
      <AppHeader
        title="Nueva Ubicación"
        onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}
        rightAction={
          <TouchableOpacity onPress={handleSavePress} disabled={!canSave}>
            {isSaving
              ? <ActivityIndicator size="small" color={colors.primary[500]} />
              : <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>Guardar</Text>
            }
          </TouchableOpacity>
        }
      />

      {isSaving && <LoadingOverlay message="Guardando..." />}

      {/* Hidden web file input */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' } as any}
          onChange={(e: any) => {
            const file = e.target.files?.[0];
            if (file) setImageUri(URL.createObjectURL(file));
            e.target.value = '';
          }}
        />
      )}

      {/* Consent Modal */}
      <Modal visible={showConsent} transparent animationType="fade" onRequestClose={() => setShowConsent(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconRow}><AlertTriangle size={28} color={colors.warning} /></View>
            <Text style={styles.modalTitle}>Declaración de Consentimiento</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Las imágenes <Text style={styles.bold}>no contienen personas</Text>, rostros ni datos personales.</Text>
              <Text style={styles.bullet}>• Las fotos muestran únicamente el espacio físico.</Text>
              <Text style={styles.bullet}>• La información proporcionada es verídica.</Text>
            </View>
            <Text style={styles.modalWarning}>
              El incumplimiento puede resultar en una <Text style={styles.bold}>suspensión temporal o permanente</Text> de tu cuenta.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowConsent(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConsentConfirm}>
                <Text style={styles.confirmBtnText}>Acepto y envío</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Private Location Info Modal */}
      <Modal visible={showPrivateInfo} transparent animationType="fade" onRequestClose={() => setShowPrivateInfo(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconRow}><Lock size={28} color="#6366f1" /></View>
            <Text style={styles.modalTitle}>Ubicación con Acceso Restringido</Text>
            <Text style={styles.privateModalDesc}>
              Estás marcando esta ubicación como de <Text style={styles.bold}>acceso restringido</Text>. Esto significa que se encuentra dentro de una institución privada como:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Empresas o zonas de trabajo</Text>
              <Text style={styles.bullet}>• Escuelas o universidades</Text>
              <Text style={styles.bullet}>• Deportivos o clubes privados</Text>
              <Text style={styles.bullet}>• Hospitales o clínicas</Text>
            </View>
            <View style={styles.privateModalNote}>
              <Info size={16} color="#6366f1" />
              <Text style={styles.privateModalNoteText}>
                Esta ubicación aparecerá en el mapa con un indicador especial para que otros usuarios sepan que el acceso <Text style={styles.bold}>no es público</Text>.
              </Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPrivateInfo(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#6366f1' }]} onPress={handlePrivateConfirm}>
                <Text style={styles.confirmBtnText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Map Picker Modal */}
      <Modal visible={showMapPicker} transparent animationType="slide" onRequestClose={() => setShowMapPicker(false)}>
        <View style={styles.pickerModalContainer}>
          <View style={styles.pickerModalHeader}>
            <Text style={styles.pickerModalTitle}>Seleccionar ubicación</Text>
            <TouchableOpacity onPress={() => setShowMapPicker(false)}>
              <X size={22} color={colors.slate[600]} />
            </TouchableOpacity>
          </View>
          <View style={styles.pickerMapContainer}>
            {Platform.OS === 'web' ? (
              <iframe
                ref={mapPickerIframeRef}
                srcDoc={mapPickerHtml}
                allow="geolocation"
                style={{ width: '100%', height: '100%', border: 'none' } as any}
                title="Seleccionar ubicación"
              />
            ) : MapViewComp ? (
              <MapViewComp
                style={{ flex: 1 }}
                initialRegion={{ latitude: pickerCoords.latitude, longitude: pickerCoords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                onPress={(e: any) => setPickerCoords({ latitude: e.nativeEvent.coordinate.latitude, longitude: e.nativeEvent.coordinate.longitude })}
              >
                <RNMarker coordinate={pickerCoords} draggable
                  onDragEnd={(e: any) => setPickerCoords({ latitude: e.nativeEvent.coordinate.latitude, longitude: e.nativeEvent.coordinate.longitude })}
                />
              </MapViewComp>
            ) : (
              <View style={styles.mapUnavailable}><Text style={{ color: colors.slate[400] }}>Mapa no disponible</Text></View>
            )}
          </View>
          <View style={styles.pickerCoordsRow}>
            <MapPin size={14} color={colors.slate[500]} />
            <Text style={styles.pickerCoordsText}>{pickerCoords.latitude.toFixed(5)}, {pickerCoords.longitude.toFixed(5)}</Text>
          </View>
          <TouchableOpacity style={styles.pickerConfirmBtn} onPress={handleMapPickerConfirm}>
            <Check size={18} color={colors.white} />
            <Text style={styles.pickerConfirmText}>Confirmar ubicación</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Type Selector */}
        <View style={styles.typeSelectorGrid}>
          {[
            { key: 'LACTARIO' as PlaceType, emoji: '🤱', title: 'Lactario', desc: 'Sala de lactancia' },
            { key: 'CAMBIADOR' as PlaceType, emoji: '🚼', title: 'Cambiador', desc: 'Mesa para pañal' },
            { key: 'BANO_FAMILIAR' as PlaceType, emoji: '🚻', title: 'Baño Familiar', desc: 'Baño accesible' },
            { key: 'PUNTO_INTERES' as PlaceType, emoji: '⭐', title: 'Punto de Interés', desc: 'Parque, restaurante…' },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.typeCard, placeType === item.key && styles.typeCardSelected]}
              onPress={() => handlePlaceTypeChange(item.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.typeEmoji}>{item.emoji}</Text>
              <Text style={[styles.typeCardTitle, placeType === item.key && styles.typeCardTitleSelected]}>{item.title}</Text>
              <Text style={[styles.typeCardDesc, placeType === item.key && styles.typeCardDescSelected]}>{item.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {placeType !== null && (
          <>
            {/* Photo */}
            <View style={styles.section}>
              <Text style={styles.label}>Foto del lugar</Text>
              <TouchableOpacity onPress={handleImagePick} style={styles.imagePicker}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                ) : (
                  <View style={styles.placeholder}>
                    <View style={styles.cameraIconBg}><Camera size={24} color={colors.primary[500]} /></View>
                    <Text style={styles.placeholderText}>Toca para agregar foto</Text>
                    <View style={styles.photoOptions}>
                      <View style={styles.photoOption}>
                        <Camera size={14} color={colors.slate[500]} />
                        <Text style={styles.photoOptionText}>Cámara</Text>
                      </View>
                      <View style={styles.photoOptionDivider} />
                      <View style={styles.photoOption}>
                        <ImagePlus size={14} color={colors.slate[500]} />
                        <Text style={styles.photoOptionText}>Galería</Text>
                      </View>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
              {imageUri && (
                <TouchableOpacity onPress={handleImagePick} style={styles.changePhotoBtn}>
                  <Text style={styles.changePhotoText}>Cambiar foto</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Name — two fields */}
            <View style={styles.section}>
              <Text style={styles.label}>Establecimiento *</Text>
              <TextInput style={styles.input} placeholder="Ej. Liverpool, Sanborns, Hospital Christus"
                placeholderTextColor={colors.slate[400]} value={establishmentName} onChangeText={setEstablishmentName} />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Ubicación / Plaza / Zona *</Text>
              <TextInput style={styles.input} placeholder="Ej. Plaza Esfera, Valle Poniente, Zona Centro"
                placeholderTextColor={colors.slate[400]} value={locationName} onChangeText={setLocationName} />
              {compositeName.length >= 3 && (
                <Text style={styles.namePreview}>
                  Se registrará como: <Text style={styles.namePreviewBold}>{compositeName}</Text>
                </Text>
              )}
            </View>

            {/* Address + Map Picker */}
            <View style={styles.section}>
              <Text style={styles.label}>Dirección</Text>
              <TextInput
                style={[styles.input, !isPrivileged && styles.inputDisabled]}
                placeholder="Selecciona en el mapa para autocompletar"
                placeholderTextColor={colors.slate[400]}
                value={address}
                onChangeText={isPrivileged ? setAddress : undefined}
                editable={isPrivileged}
              />
              <TouchableOpacity style={styles.mapPickerBtn} onPress={() => {
                const coords = pickedLocation ?? currentLocation;
                setPickerCoords(coords);
                setMapPickerHtml(buildMapPickerHtml(coords.latitude, coords.longitude));
                setShowMapPicker(true);
              }}>
                <MapPin size={16} color={colors.primary[500]} />
                <Text style={styles.mapPickerBtnText}>Seleccionar en el mapa</Text>
                {pickedLocation && <Check size={14} color={colors.success} style={{ marginLeft: 'auto' } as any} />}
              </TouchableOpacity>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput style={[styles.input, styles.textArea]}
                placeholder="¿Cómo es el espacio? ¿Es limpio, privado?"
                placeholderTextColor={colors.slate[400]} multiline numberOfLines={3}
                value={description} onChangeText={setDescription} />
            </View>

            {/* Private Location Toggle */}
            <View style={styles.section}>
              <Text style={styles.label}>Acceso</Text>
              <TouchableOpacity style={[styles.privateToggle, isPrivate && styles.privateToggleActive]} onPress={handlePrivateToggle} activeOpacity={0.8}>
                <View style={[styles.privateToggleIcon, isPrivate && styles.privateToggleIconActive]}>
                  <Lock size={18} color={isPrivate ? '#fff' : '#6366f1'} />
                </View>
                <View style={styles.privateToggleContent}>
                  <Text style={[styles.privateToggleTitle, isPrivate && styles.privateToggleTitleActive]}>Acceso Restringido</Text>
                  <Text style={styles.privateToggleDesc}>Ubicación dentro de una institución privada</Text>
                </View>
                <View style={[styles.privateToggleCheck, isPrivate && styles.privateToggleCheckActive]}>
                  {isPrivate && <Check size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            </View>

            {/* Tags */}
            <View style={styles.section}>
              <Text style={styles.label}>
                Etiquetas <Text style={styles.labelOptional}>(opcional)</Text>
              </Text>
              <Text style={styles.tagHint}>Facilitan la búsqueda (ej: "liverpool", "apodaca")</Text>
              <View style={styles.tagInputRow}>
                <TextInput
                  style={[styles.input, styles.tagInput]}
                  placeholder="Añadir etiqueta"
                  placeholderTextColor={colors.slate[400]}
                  value={tagInput}
                  onChangeText={setTagInput}
                  returnKeyType="done"
                  onSubmitEditing={addTag}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.addTagBtn} onPress={addTag}>
                  <Plus size={18} color={colors.white} />
                </TouchableOpacity>
              </View>
              {tags.length > 0 && (
                <View style={styles.tagsRow}>
                  {tags.map((t) => (
                    <TouchableOpacity key={t} style={styles.tagChip} onPress={() => removeTag(t)}>
                      <Text style={styles.tagChipText}>{t}</Text>
                      <X size={10} color={colors.primary[500]} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Access — multi-select */}
            {/* Access — hidden for locked types, shown for others */}
            {isAccessLocked ? (
              <View style={styles.section}>
                <Text style={styles.label}>Acceso</Text>
                <Text style={styles.accessHint}>
                  {placeType === 'LACTARIO'
                    ? 'Los lactarios son exclusivamente para mujeres'
                    : 'Los baños familiares son Unisex/Familiar por defecto'}
                </Text>
                <Chip label={accessSelection[0]} selected />
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.label}>Acceso</Text>
                <View style={styles.chipsRow}>
                  {Object.values(GenderAccess).map((type) => (
                    <Chip
                      key={type}
                      label={type}
                      selected={accessSelection.includes(type)}
                      onPress={() => handleAccessToggle(type)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Lactario: full amenities */}
            {placeType === 'LACTARIO' && (
              <View style={styles.section}>
                <Text style={styles.label}>Servicios disponibles</Text>
                <View style={styles.chipsRow}>
                  {Object.values(Amenity).map((amenity) => (
                    <Chip key={amenity} label={AMENITY_LABELS[amenity] || amenity}
                      selected={selectedAmenities.includes(amenity)} onPress={() => toggleAmenity(amenity)}
                      icon={selectedAmenities.includes(amenity) ? <Check size={12} color={colors.white} /> : undefined}
                      size="sm" />
                  ))}
                </View>
              </View>
            )}

            {/* Cambiador: specifications */}
            {placeType === 'CAMBIADOR' && (
              <View style={styles.section}>
                <Text style={styles.label}>Especificaciones</Text>
                <View style={styles.chipsRow}>
                  {CHANGER_SPECS.map((spec) => (
                    <Chip key={spec} label={spec}
                      selected={selectedSpecs.includes(spec)} onPress={() => toggleSpec(spec)}
                      icon={selectedSpecs.includes(spec) ? <Check size={12} color={colors.white} /> : undefined}
                      size="sm" />
                  ))}
                </View>
              </View>
            )}

            {/* Baño Familiar: specifications */}
            {placeType === 'BANO_FAMILIAR' && (
              <View style={styles.section}>
                <Text style={styles.label}>Comodidades</Text>
                <View style={styles.chipsRow}>
                  {BATHROOM_SPECS.map((spec) => (
                    <Chip key={spec} label={spec}
                      selected={selectedBathroomSpecs.includes(spec)} onPress={() => toggleBathroomSpec(spec)}
                      icon={selectedBathroomSpecs.includes(spec) ? <Check size={12} color={colors.white} /> : undefined}
                      size="sm" />
                  ))}
                </View>
              </View>
            )}

            {/* Punto de Interés: type selection */}
            {placeType === 'PUNTO_INTERES' && (
              <View style={styles.section}>
                <Text style={styles.label}>Tipo de lugar</Text>
                <Text style={styles.tagHint}>Selecciona uno o varios tipos que apliquen</Text>
                <View style={styles.chipsRow}>
                  {POI_TYPES.map((t) => (
                    <Chip key={t} label={t}
                      selected={selectedPoiTypes.includes(t)} onPress={() => togglePoiType(t)}
                      icon={selectedPoiTypes.includes(t) ? <Check size={12} color={colors.white} /> : undefined}
                      size="sm" />
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  saveText: { ...typography.bodyBold, color: colors.primary[500] },
  saveTextDisabled: { color: colors.slate[300] },
  content: { padding: spacing.xxl, paddingBottom: 100 },
  section: { marginBottom: spacing.xxl },
  label: { ...typography.smallBold, color: colors.slate[700], marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelOptional: { fontSize: 11, color: colors.slate[400], textTransform: 'none', fontWeight: '400' },
  input: { backgroundColor: colors.slate[50], borderWidth: 1, borderColor: colors.slate[200], borderRadius: radii.md, padding: spacing.md, fontSize: 16, color: colors.slate[800] },
  inputDisabled: { backgroundColor: colors.slate[100], color: colors.slate[500] },
  textArea: { height: 100, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  // Type selector
  typeSelectorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xxl },
  typeCard: {
    flexBasis: '47%', alignItems: 'center', padding: spacing.lg,
    borderRadius: radii.lg, borderWidth: 2, borderColor: colors.slate[200],
    backgroundColor: colors.slate[50],
  },
  typeCardSelected: { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  typeEmoji: { fontSize: 32, marginBottom: spacing.sm },
  typeCardTitle: { ...typography.bodyBold, color: colors.slate[700] },
  typeCardTitleSelected: { color: colors.primary[600] },
  typeCardDesc: { ...typography.caption, color: colors.slate[400], marginTop: 2, textAlign: 'center' },
  typeCardDescSelected: { color: colors.primary[400] },

  // Photo
  imagePicker: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.lg, borderWidth: 2, borderColor: colors.slate[200], borderStyle: 'dashed', overflow: 'hidden' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.slate[50], gap: spacing.xs },
  cameraIconBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary[50], justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs },
  placeholderText: { ...typography.small, color: colors.slate[500] },
  photoOptions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  photoOption: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  photoOptionDivider: { width: 1, height: 14, backgroundColor: colors.slate[300], marginHorizontal: spacing.sm },
  photoOptionText: { ...typography.caption, color: colors.slate[500] },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  changePhotoBtn: { marginTop: spacing.sm, alignSelf: 'flex-end' },
  changePhotoText: { ...typography.caption, color: colors.primary[500], textDecorationLine: 'underline' },

  // Address / Map picker
  mapPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.primary[300], borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.primary[50], marginTop: spacing.sm },
  mapPickerBtnText: { ...typography.small, color: colors.primary[600], fontWeight: '600' },

  // Tags
  namePreview: { ...typography.caption, color: colors.slate[500], marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  namePreviewBold: { fontWeight: '700', color: colors.primary[600] },
  accessHint: { ...typography.caption, color: colors.slate[400], marginBottom: spacing.sm },
  tagHint: { ...typography.caption, color: colors.slate[400], marginBottom: spacing.sm },
  tagInputRow: { flexDirection: 'row', gap: spacing.sm },
  tagInput: { flex: 1 },
  addTagBtn: { width: 46, height: 46, borderRadius: radii.md, backgroundColor: colors.primary[500], alignItems: 'center', justifyContent: 'center' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary[50], paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.full, borderWidth: 1, borderColor: colors.primary[200] },
  tagChipText: { ...typography.caption, color: colors.primary[600], fontWeight: '600' },

  // Private toggle
  privateToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 2, borderColor: colors.slate[200], borderRadius: radii.lg, padding: spacing.lg, backgroundColor: colors.slate[50] },
  privateToggleActive: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  privateToggleIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  privateToggleIconActive: { backgroundColor: '#6366f1' },
  privateToggleContent: { flex: 1 },
  privateToggleTitle: { ...typography.bodyBold, color: colors.slate[700] },
  privateToggleTitleActive: { color: '#4338ca' },
  privateToggleDesc: { ...typography.caption, color: colors.slate[400], marginTop: 2 },
  privateToggleCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.slate[300], alignItems: 'center', justifyContent: 'center' },
  privateToggleCheckActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  privateModalDesc: { ...typography.small, color: colors.slate[600], lineHeight: 22, marginBottom: spacing.md },
  privateModalNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: '#eef2ff', padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.xl },
  privateModalNoteText: { ...typography.small, color: '#4338ca', flex: 1, lineHeight: 20 },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  modalCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.xxl, width: '100%', ...shadows.lg },
  modalIconRow: { alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.h3, color: colors.slate[800], textAlign: 'center', marginBottom: spacing.sm },
  bulletList: { gap: spacing.sm, marginBottom: spacing.md },
  bullet: { ...typography.small, color: colors.slate[600], lineHeight: 20 },
  bold: { fontWeight: '700', color: colors.slate[800] },
  modalWarning: { ...typography.small, color: colors.error, backgroundColor: colors.errorLight, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.xl, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.slate[300], alignItems: 'center' },
  cancelBtnText: { ...typography.bodyBold, color: colors.slate[600] },
  confirmBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radii.md, backgroundColor: colors.primary[500], alignItems: 'center' },
  confirmBtnText: { ...typography.bodyBold, color: colors.white },
  pickerModalContainer: { flex: 1, backgroundColor: colors.white, marginTop: 60, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl },
  pickerModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.xxl, borderBottomWidth: 1, borderBottomColor: colors.slate[100] },
  pickerModalTitle: { ...typography.h4, color: colors.slate[800] },
  pickerMapContainer: { flex: 1, minHeight: Platform.OS === 'web' ? 400 : undefined },
  mapUnavailable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pickerCoordsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, backgroundColor: colors.slate[50] },
  pickerCoordsText: { ...typography.caption, color: colors.slate[600] },
  pickerConfirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary[500], margin: spacing.xxl, padding: spacing.lg, borderRadius: radii.lg },
  pickerConfirmText: { ...typography.bodyBold, color: colors.white },
});
