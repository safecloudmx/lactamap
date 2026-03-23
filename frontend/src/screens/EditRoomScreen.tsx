import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  ActivityIndicator, Alert, StyleSheet, Modal, Platform, ActionSheetIOS,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Check, Plus, X, MapPin, Camera, ImagePlus } from 'lucide-react-native';
import { Amenity, GenderAccess, Lactario } from '../types';
import { AMENITY_LABELS } from '../constants';
import { updateLactario, createEditProposal, uploadPhoto, deletePhoto } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { AppHeader, Chip, LoadingOverlay } from '../components/ui';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

let Location: any = null;
try { Location = require('expo-location'); } catch (_) {}

let RNMaps: any = null;
try { RNMaps = require('react-native-maps'); } catch (_) {}

const ADMIN_ROLES = ['ADMIN', 'ELITE'];
const CHANGER_SPECS = ['Dentro de un Baño', 'Abierto', 'Privado', 'Lavabo', 'Climatizado'];

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
  box-shadow:0 2px 8px rgba(0,0,0,0.15);pointer-events:none;}</style>
</head><body>
<div id="hint">Toca para mover el marcador</div>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false}).setView([${lat},${lng}],16);
L.control.zoom({position:'bottomright'}).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap',maxZoom:19}).addTo(map);
var marker=L.marker([${lat},${lng}],{draggable:true}).addTo(map);
function notify(ll){window.parent.postMessage({type:'pinMoved',lat:ll.lat,lng:ll.lng},'*');}
notify(marker.getLatLng());
marker.on('dragend',function(){notify(marker.getLatLng());});
map.on('click',function(e){marker.setLatLng(e.latlng);notify(e.latlng);});
<\/script></body></html>`;
}

export default function EditRoomScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const room: Lactario = route.params?.room;

  const isPrivileged = ADMIN_ROLES.includes(user?.role ?? '');
  const placeType = room.placeType ?? 'LACTARIO';
  const isCambiador = placeType === 'CAMBIADOR';
  const isBanoFamiliar = placeType === 'BANO_FAMILIAR';

  // Parse existing name into establishment + location
  const parsedName = (room.name || '').split(' — ');
  const [establishmentName, setEstablishmentName] = useState(parsedName[0] || '');
  const [locationName, setLocationName] = useState(parsedName[1] || '');

  const compositeName = locationName.trim()
    ? `${establishmentName.trim()} — ${locationName.trim()}`
    : establishmentName.trim();

  const [description, setDescription] = useState(room.description || '');
  const [address, setAddress] = useState(room.address || '');

  // Parse existing genderAccess (could be "Hombres, Mujeres" or single value)
  const parseAccessSelection = (): string[] => {
    const raw = (room.access as string) || (room as any).genderAccess || GenderAccess.NEUTRAL;
    if (raw.includes(', ')) return raw.split(', ');
    return [raw];
  };
  const [accessSelection, setAccessSelection] = useState<string[]>(parseAccessSelection());

  const isAccessLocked = isBanoFamiliar || placeType === 'LACTARIO';
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

  const genderAccessValue = accessSelection.sort().join(', ');
  const [selectedAmenities, setSelectedAmenities] = useState<Amenity[]>(
    (room.amenities as Amenity[]) || []
  );
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>(
    isCambiador ? (room.amenities as string[]) || [] : []
  );
  const [tags, setTags] = useState<string[]>(room.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<{ id: string; url: string }[]>(room.photos || []);
  const fileInputRef = useRef<any>(null);

  const totalPhotos = existingPhotos.length + pendingPhotos.length;

  const [pickedLocation, setPickedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickerCoords, setPickerCoords] = useState({
    latitude: Number(room.latitude) || 25.6866,
    longitude: Number(room.longitude) || -100.3161,
  });
  const mapPickerIframeRef = useRef<any>(null);

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

  const handleMapPickerConfirm = async () => {
    setPickedLocation(pickerCoords);
    setShowMapPicker(false);
    const addr = await reverseGeocode(pickerCoords.latitude, pickerCoords.longitude);
    if (addr) setAddress(addr);
  };

  const addPendingPhoto = (uri: string) => {
    if (totalPhotos >= 5) { Alert.alert('Límite alcanzado', 'Máximo 5 fotos por lugar.'); return; }
    setPendingPhotos((prev) => [...prev, uri]);
  };

  const pickFromGalleryNative = async () => {
    if (!ImagePicker) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Se necesita acceso a la galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled && result.assets[0]) addPendingPhoto(result.assets[0].uri);
  };

  const takePhotoNative = async () => {
    if (!ImagePicker) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled && result.assets[0]) addPendingPhoto(result.assets[0].uri);
  };

  const handleImagePick = () => {
    if (totalPhotos >= 5) { Alert.alert('Límite alcanzado', 'Máximo 5 fotos por lugar.'); return; }
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

  const handleDeleteExistingPhoto = async (photoId: string) => {
    try {
      await deletePhoto(photoId);
      setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch {
      Alert.alert('Error', 'No se pudo eliminar la foto.');
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const toggleAmenity = (amenity: Amenity) =>
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    );

  const toggleSpec = (spec: string) =>
    setSelectedSpecs((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );

  const canSave = establishmentName.trim().length >= 3 && locationName.trim().length >= 2;

  const handleSave = async () => {
    if (!canSave) {
      Alert.alert('Error', 'Completa los campos de Establecimiento y Ubicación');
      return;
    }
    setIsSaving(true);
    try {
      const amenities = isCambiador ? selectedSpecs : selectedAmenities.map(String);
      const payload = {
        name: compositeName,
        address: address.trim() || undefined,
        description: description.trim(),
        amenities,
        tags,
        genderAccess: genderAccessValue,
        ...(pickedLocation && {
          latitude: pickedLocation.latitude,
          longitude: pickedLocation.longitude,
        }),
      };

      if (isPrivileged) {
        await updateLactario(room.id, payload);
        for (const uri of pendingPhotos) {
          try { await uploadPhoto(room.id, uri); } catch { /* skip failed uploads */ }
        }
        navigation.goBack();
      } else {
        await createEditProposal({ lactarioId: room.id, ...payload });
        navigation.goBack();
        Alert.alert('Propuesta enviada', 'Tus cambios serán revisados por un moderador antes de publicarse.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudieron guardar los cambios');
    } finally {
      setIsSaving(false);
    }
  };

  const MapViewComp = RNMaps?.default;
  const RNMarker = RNMaps?.Marker;

  const typeBadgeColor = isCambiador ? '#7c3aed' : colors.primary[500];
  const typeBadgeBg = isCambiador ? '#ede9fe' : colors.primary[50];
  const typeLabel = isCambiador ? '🚼 Cambiador' : '🤱 Lactario';

  return (
    <View style={styles.container}>
      <AppHeader
        title="Editar Lugar"
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={handleSave} disabled={isSaving || !canSave}>
            {isSaving
              ? <ActivityIndicator size="small" color={colors.primary[500]} />
              : <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>
                  {isPrivileged ? 'Guardar' : 'Proponer'}
                </Text>
            }
          </TouchableOpacity>
        }
      />

      {isSaving && <LoadingOverlay message={isPrivileged ? 'Guardando cambios...' : 'Enviando propuesta...'} />}

      {/* Hidden web file input for photo */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' } as any}
          onChange={(e: any) => {
            const file = e.target.files?.[0];
            if (file) addPendingPhoto(URL.createObjectURL(file));
            e.target.value = '';
          }}
        />
      )}

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
                srcDoc={buildMapPickerHtml(pickerCoords.latitude, pickerCoords.longitude)}
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

        {/* Type badge + proposal notice */}
        <View style={styles.metaRow}>
          <View style={[styles.typeBadge, { backgroundColor: typeBadgeBg }]}>
            <Text style={[styles.typeBadgeText, { color: typeBadgeColor }]}>{typeLabel}</Text>
          </View>
          {!isPrivileged && (
            <Text style={styles.proposalNotice}>Los cambios irán a revisión</Text>
          )}
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <View style={styles.photoSectionHeader}>
            <Text style={styles.label}>Fotos del lugar</Text>
            <Text style={styles.photoCount}>{totalPhotos}/5</Text>
          </View>
          <View style={styles.photoGrid}>
            {/* Existing photos */}
            {existingPhotos.map((photo) => (
              <View key={photo.id} style={styles.photoThumb}>
                <Image source={{ uri: photo.url }} style={styles.photoThumbImage} resizeMode="cover" />
                <TouchableOpacity style={styles.photoDeleteBtn} onPress={() => handleDeleteExistingPhoto(photo.id)}>
                  <X size={12} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            {/* Pending (new) photos */}
            {pendingPhotos.map((uri, idx) => (
              <View key={`pending-${idx}`} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoThumbImage} resizeMode="cover" />
                <TouchableOpacity style={styles.photoDeleteBtn} onPress={() => setPendingPhotos((prev) => prev.filter((_, i) => i !== idx))}>
                  <X size={12} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            {/* Add photo button */}
            {totalPhotos < 5 && (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={handleImagePick}>
                <ImagePlus size={22} color={colors.slate[400]} />
                <Text style={styles.addPhotoBtnText}>Agregar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Establishment */}
        <View style={styles.section}>
          <Text style={styles.label}>Establecimiento *</Text>
          <TextInput style={styles.input} value={establishmentName} onChangeText={setEstablishmentName}
            placeholderTextColor={colors.slate[400]} placeholder="Ej. Liverpool, Sanborns, Hospital Christus" />
        </View>

        {/* Location / Zone */}
        <View style={styles.section}>
          <Text style={styles.label}>Ubicación / Plaza / Zona *</Text>
          <TextInput style={styles.input} value={locationName} onChangeText={setLocationName}
            placeholderTextColor={colors.slate[400]} placeholder="Ej. Plaza Esfera, Valle Poniente, Zona Centro" />
          {compositeName.length >= 3 && (
            <Text style={styles.namePreview}>
              Se guardará como: <Text style={styles.namePreviewBold}>{compositeName}</Text>
            </Text>
          )}
        </View>

        {/* Address + Map Picker */}
        <View style={styles.section}>
          <Text style={styles.label}>Dirección</Text>
          <TextInput
            style={[styles.input, !isPrivileged && styles.inputDisabled]}
            value={address} onChangeText={isPrivileged ? setAddress : undefined}
            editable={isPrivileged}
            placeholderTextColor={colors.slate[400]}
            placeholder="Selecciona en el mapa para actualizar"
          />
          <TouchableOpacity style={styles.mapPickerBtn} onPress={() => setShowMapPicker(true)}>
            <MapPin size={16} color={colors.primary[500]} />
            <Text style={styles.mapPickerBtnText}>Actualizar ubicación en el mapa</Text>
            {pickedLocation && <Check size={14} color={colors.success} style={{ marginLeft: 'auto' } as any} />}
          </TouchableOpacity>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Descripción</Text>
          <TextInput style={[styles.input, styles.textArea]}
            value={description} onChangeText={setDescription} multiline numberOfLines={3}
            placeholderTextColor={colors.slate[400]} placeholder="Descripción del lugar"
            textAlignVertical="top" />
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <Text style={styles.label}>Etiquetas <Text style={styles.labelOptional}>(opcional)</Text></Text>
          <View style={styles.tagInputRow}>
            <TextInput style={[styles.input, styles.tagInput]} placeholder="Añadir etiqueta"
              placeholderTextColor={colors.slate[400]} value={tagInput} onChangeText={setTagInput}
              returnKeyType="done" onSubmitEditing={addTag} autoCapitalize="none" />
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

        {/* Access */}
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

        {/* Lactario amenities */}
        {!isCambiador && (
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

        {/* Cambiador specs */}
        {isCambiador && (
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  saveText: { ...typography.bodyBold, color: colors.primary[500] },
  saveTextDisabled: { color: colors.slate[300] },
  content: { padding: spacing.xxl, paddingBottom: 100 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  typeBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full },
  typeBadgeText: { ...typography.smallBold },
  proposalNotice: { ...typography.caption, color: colors.warning, flex: 1 },
  section: { marginBottom: spacing.xxl },
  label: { ...typography.smallBold, color: colors.slate[700], marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelOptional: { fontSize: 11, color: colors.slate[400], textTransform: 'none', fontWeight: '400' },
  namePreview: { ...typography.caption, color: colors.slate[500], marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  namePreviewBold: { fontWeight: '700', color: colors.primary[600] },
  accessHint: { ...typography.caption, color: colors.slate[400], marginBottom: spacing.sm },
  input: { backgroundColor: colors.slate[50], borderWidth: 1, borderColor: colors.slate[200], borderRadius: radii.md, padding: spacing.md, fontSize: 16, color: colors.slate[800] },
  inputDisabled: { backgroundColor: colors.slate[100], color: colors.slate[500] },
  textArea: { height: 100, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mapPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.primary[300], borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.primary[50], marginTop: spacing.sm },
  mapPickerBtnText: { ...typography.small, color: colors.primary[600], fontWeight: '600' },
  tagInputRow: { flexDirection: 'row', gap: spacing.sm },
  tagInput: { flex: 1 },
  addTagBtn: { width: 46, height: 46, borderRadius: radii.md, backgroundColor: colors.primary[500], alignItems: 'center', justifyContent: 'center' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary[50], paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.full, borderWidth: 1, borderColor: colors.primary[200] },
  tagChipText: { ...typography.caption, color: colors.primary[600], fontWeight: '600' },
  pickerModalContainer: { flex: 1, backgroundColor: colors.white, marginTop: 60, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl },
  pickerModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.xxl, borderBottomWidth: 1, borderBottomColor: colors.slate[100] },
  pickerModalTitle: { ...typography.h4, color: colors.slate[800] },
  pickerMapContainer: { flex: 1 },
  mapUnavailable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pickerCoordsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, backgroundColor: colors.slate[50] },
  pickerCoordsText: { ...typography.caption, color: colors.slate[600] },
  pickerConfirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary[500], margin: spacing.xxl, padding: spacing.lg, borderRadius: radii.lg },
  pickerConfirmText: { ...typography.bodyBold, color: colors.white },
  photoSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  photoCount: { ...typography.caption, color: colors.slate[400] },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoThumb: { width: 90, height: 90, borderRadius: radii.md, overflow: 'hidden', position: 'relative' },
  photoThumbImage: { width: 90, height: 90 },
  photoDeleteBtn: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  addPhotoBtn: { width: 90, height: 90, borderRadius: radii.md, borderWidth: 2, borderColor: colors.slate[200], borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.slate[50] },
  addPhotoBtnText: { ...typography.caption, color: colors.slate[400] },
});
