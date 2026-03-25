import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Platform, Image, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ArrowLeft, Weight, Ruler, Calendar, Camera, ImageIcon, X,
} from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { createGrowthRecord, uploadGrowthPhoto } from '../services/api';
import { infoAlert } from '../services/crossPlatformAlert';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

export default function GrowthAddScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { babyId, birthDate } = route.params;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [headCm, setHeadCm] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<{ uri: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const [measuredAt] = useState(new Date());

  const pickFromGallery = async () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }
    if (!ImagePicker) { Alert.alert('No disponible'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Se necesita acceso a la galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, { uri: result.assets[0].uri }]);
    }
  };

  const takePhoto = async () => {
    if (!ImagePicker) { Alert.alert('No disponible'); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara.'); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, { uri: result.assets[0].uri }]);
    }
  };

  const handleWebFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      const uri = URL.createObjectURL(file);
      setPhotos((prev) => [...prev, { uri }]);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    const w = weightKg ? parseFloat(weightKg) : null;
    const h = heightCm ? parseFloat(heightCm) : null;
    const hc = headCm ? parseFloat(headCm) : null;

    if (w === null && h === null && hc === null) {
      infoAlert('Error', 'Ingresa al menos una medida (peso, estatura o circunferencia)');
      return;
    }

    if ((w !== null && (isNaN(w) || w <= 0)) ||
        (h !== null && (isNaN(h) || h <= 0)) ||
        (hc !== null && (isNaN(hc) || hc <= 0))) {
      infoAlert('Error', 'Las medidas deben ser números positivos');
      return;
    }

    setSaving(true);
    try {
      const record = await createGrowthRecord({
        babyId,
        measuredAt: measuredAt.toISOString(),
        weightKg: w,
        heightCm: h,
        headCircumferenceCm: hc,
        notes: notes.trim() || undefined,
      });

      // Upload photos after creating the record
      for (const photo of photos) {
        try {
          await uploadGrowthPhoto(record.id, photo.uri);
        } catch (e) {
          console.warn('Error uploading growth photo:', e);
        }
      }

      navigation.goBack();
    } catch (e) {
      console.warn('Error saving growth record:', e);
      infoAlert('Error', 'No se pudo guardar el registro');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: Date) => d.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const formatTime = (d: Date) => d.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={24} color={colors.slate[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrar Crecimiento</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Date display */}
        <View style={styles.dateRow}>
          <Calendar size={18} color={colors.slate[500]} />
          <Text style={styles.dateText}>{formatDate(measuredAt)}</Text>
          <Text style={styles.timeText}>{formatTime(measuredAt)}</Text>
        </View>

        {/* Measurement inputs */}
        <View style={styles.inputCard}>
          <View style={styles.inputRow}>
            <View style={[styles.inputIcon, { backgroundColor: colors.primary[50] }]}>
              <Weight size={20} color={colors.primary[500]} />
            </View>
            <Text style={styles.inputLabel}>Peso</Text>
            <View style={styles.inputFieldContainer}>
              <TextInput
                style={styles.inputField}
                placeholder="0.0"
                placeholderTextColor={colors.slate[300]}
                value={weightKg}
                onChangeText={setWeightKg}
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <Text style={styles.inputUnit}>kg</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.inputRow}>
            <View style={[styles.inputIcon, { backgroundColor: colors.infoLight }]}>
              <Ruler size={20} color={colors.info} />
            </View>
            <Text style={styles.inputLabel}>Estatura</Text>
            <View style={styles.inputFieldContainer}>
              <TextInput
                style={styles.inputField}
                placeholder="0.0"
                placeholderTextColor={colors.slate[300]}
                value={heightCm}
                onChangeText={setHeightCm}
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <Text style={styles.inputUnit}>cm</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.inputRow}>
            <View style={[styles.inputIcon, { backgroundColor: '#fef3c7' }]}>
              <Text style={{ fontSize: 16 }}>🧠</Text>
            </View>
            <Text style={styles.inputLabel}>Cabeza</Text>
            <View style={styles.inputFieldContainer}>
              <TextInput
                style={styles.inputField}
                placeholder="0.0"
                placeholderTextColor={colors.slate[300]}
                value={headCm}
                onChangeText={setHeadCm}
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <Text style={styles.inputUnit}>cm</Text>
            </View>
          </View>
        </View>

        {/* Photos */}
        <View style={styles.photosCard}>
          <Text style={styles.notesLabel}>Fotos</Text>
          <View style={styles.photosGrid}>
            {photos.map((p, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri: p.uri }} style={styles.photoImg} />
                <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                  <X size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <View style={styles.photoActions}>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity style={styles.photoBtn} onPress={takePhoto} activeOpacity={0.7}>
                    <Camera size={22} color={colors.primary[500]} />
                    <Text style={styles.photoBtnText}>Cámara</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.photoBtn} onPress={pickFromGallery} activeOpacity={0.7}>
                  <ImageIcon size={22} color={colors.info} />
                  <Text style={styles.photoBtnText}>Galería</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {Platform.OS === 'web' && (
            <input
              ref={fileInputRef as any}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleWebFileChange}
            />
          )}
          <Text style={styles.photoHint}>Máximo 5 fotos por registro</Text>
        </View>

        {/* Notes */}
        <View style={styles.notesCard}>
          <Text style={styles.notesLabel}>Notas</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Notas opcionales..."
            placeholderTextColor={colors.slate[300]}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
          />
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.saveBtnText}>Guardando...</Text>
            </View>
          ) : (
            <Text style={styles.saveBtnText}>Guardar</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  headerTitle: {
    ...typography.h4,
    color: colors.slate[800],
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  dateText: {
    ...typography.bodyBold,
    color: colors.slate[700],
  },
  timeText: {
    ...typography.body,
    color: colors.slate[500],
  },
  inputCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  inputIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    ...typography.body,
    color: colors.slate[700],
    flex: 1,
  },
  inputFieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inputField: {
    ...typography.h4,
    color: colors.slate[800],
    textAlign: 'right',
    minWidth: 60,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.slate[50],
    borderRadius: radii.sm,
  },
  inputUnit: {
    ...typography.small,
    color: colors.slate[500],
    width: 24,
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate[100],
    marginHorizontal: spacing.lg,
  },
  photosCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadows.sm,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: radii.md,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoBtn: {
    width: 80,
    height: 80,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.slate[200],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.slate[50],
  },
  photoBtnText: {
    ...typography.caption,
    color: colors.slate[500],
  },
  photoHint: {
    ...typography.caption,
    color: colors.slate[400],
    marginTop: spacing.sm,
  },
  notesCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadows.sm,
  },
  notesLabel: {
    ...typography.smallBold,
    color: colors.slate[700],
    marginBottom: spacing.sm,
  },
  notesInput: {
    ...typography.small,
    color: colors.slate[800],
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: colors.primary[500],
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.white,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
