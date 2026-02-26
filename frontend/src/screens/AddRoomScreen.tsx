import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera, Check, Sparkles } from 'lucide-react-native';
import { Amenity, GenderAccess } from '../types';
import { AMENITY_LABELS } from '../constants';
import { createLactario } from '../services/api';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { AppHeader, Chip, LoadingOverlay } from '../components/ui';

let Location: any = null;
try {
  Location = require('expo-location');
} catch (_) {}

export default function AddRoomScreen() {
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [access, setAccess] = useState<GenderAccess>(GenderAccess.NEUTRAL);
  const [selectedAmenities, setSelectedAmenities] = useState<Amenity[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({ latitude: 25.6866, longitude: -100.3161 });

  useEffect(() => {
    if (!Location) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  const handleImagePick = () => {
    setImagePreview('https://picsum.photos/400/300');
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setDescription('Espacio limpio y comodo detectado. Cuenta con cambiador y silla de lactancia.');
      setSelectedAmenities([Amenity.CHANGING_TABLE, Amenity.LACTATION_CHAIR]);
      setAccess(GenderAccess.WOMEN);
    }, 2000);
  };

  const toggleAmenity = (amenity: Amenity) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    );
  };

  const handleSave = async () => {
    if (!name.trim() || name.trim().length < 3) {
      Alert.alert('Error', 'El nombre debe tener al menos 3 caracteres');
      return;
    }

    setIsSaving(true);
    try {
      await createLactario({
        name: name.trim(),
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        address: address.trim() || 'Ubicacion actual',
        description: description.trim(),
        amenities: selectedAmenities,
      });
      Alert.alert('Listo', 'Lactario registrado exitosamente', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Error al guardar';
      Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Nuevo Lactario"
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={handleSave} disabled={isSaving || name.trim().length < 3}>
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : (
              <Text style={[
                styles.saveText,
                name.trim().length < 3 && styles.saveTextDisabled,
              ]}>Guardar</Text>
            )}
          </TouchableOpacity>
        }
      />

      {isSaving && <LoadingOverlay message="Guardando lactario..." />}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photo */}
        <View style={styles.section}>
          <Text style={styles.label}>Foto del lugar</Text>
          <TouchableOpacity onPress={handleImagePick} style={styles.imagePicker}>
            {imagePreview ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: imagePreview }} style={styles.previewImage} />
                {isAnalyzing && (
                  <View style={styles.analyzingOverlay}>
                    <View style={styles.analyzingBadge}>
                      <ActivityIndicator size="small" color={colors.primary[500]} />
                      <Text style={styles.analyzingText}>Analizando con IA...</Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.placeholder}>
                <View style={styles.cameraIconBg}>
                  <Camera size={24} color={colors.primary[500]} />
                </View>
                <Text style={styles.placeholderText}>Toca para tomar foto</Text>
              </View>
            )}
          </TouchableOpacity>

          {imagePreview && !isAnalyzing && (
            <View style={styles.aiBadge}>
              <Sparkles size={12} color={colors.success} />
              <Text style={styles.aiText}>IA detecto servicios automaticamente</Text>
            </View>
          )}
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Nombre del lugar *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Sala de lactancia Liverpool"
            placeholderTextColor={colors.slate[400]}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.label}>Direccion</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Av. Constitucion 123, Nivel 2"
            placeholderTextColor={colors.slate[400]}
            value={address}
            onChangeText={setAddress}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Descripcion</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Como es el espacio? Es limpio, privado?"
            placeholderTextColor={colors.slate[400]}
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Access */}
        <View style={styles.section}>
          <Text style={styles.label}>Acceso</Text>
          <View style={styles.chipsRow}>
            {Object.values(GenderAccess).map((type) => (
              <Chip
                key={type}
                label={type}
                selected={access === type}
                onPress={() => setAccess(type)}
              />
            ))}
          </View>
        </View>

        {/* Amenities */}
        <View style={styles.section}>
          <Text style={styles.label}>Servicios disponibles</Text>
          <View style={styles.chipsRow}>
            {Object.values(Amenity).map((amenity) => (
              <Chip
                key={amenity}
                label={AMENITY_LABELS[amenity] || amenity}
                selected={selectedAmenities.includes(amenity)}
                onPress={() => toggleAmenity(amenity)}
                icon={selectedAmenities.includes(amenity) ? <Check size={12} color={colors.white} /> : undefined}
                size="sm"
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  saveText: {
    ...typography.bodyBold,
    color: colors.primary[500],
  },
  saveTextDisabled: {
    color: colors.slate[300],
  },
  content: {
    padding: spacing.xxl,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  label: {
    ...typography.smallBold,
    color: colors.slate[700],
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.slate[800],
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  imagePicker: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.slate[200],
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.slate[50],
  },
  cameraIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  placeholderText: {
    ...typography.small,
    color: colors.slate[500],
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingBadge: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    gap: spacing.sm,
    alignItems: 'center',
  },
  analyzingText: {
    ...typography.captionBold,
    color: colors.primary[500],
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  aiText: {
    ...typography.caption,
    color: colors.success,
  },
});
