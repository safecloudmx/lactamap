import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Image, Alert, StyleSheet, Platform, ActivityIndicator,
  ActionSheetIOS, KeyboardAvoidingView, Modal, Dimensions, StatusBar,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft, Minus, Plus, Camera, ImagePlus, X, Clock,
  Calendar, StickyNote, Paperclip, Droplets, Baby as BabyIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii, shadows } from '../theme';
import {
  createPumpingSession, updatePumpingSession,
  uploadPumpingPhoto, deletePumpingPhoto,
} from '../services/api';
import { PumpingSide, PumpingSession, Baby } from '../types';
import * as nursingStorage from '../services/nursingStorage';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

const SIDE_OPTIONS: { key: PumpingSide; label: string }[] = [
  { key: 'LEFT', label: 'Izquierdo' },
  { key: 'RIGHT', label: 'Derecho' },
];

const AMOUNT_STEP = 5;
const MAX_NOTES = 3000;
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function PumpingLogScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const editSession: PumpingSession | undefined = route.params?.session;
  const isEditing = !!editSession;

  const [babies, setBabies] = useState<Baby[]>([]);
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(editSession?.babyId || null);
  const [side, setSide] = useState<PumpingSide>(editSession?.side || 'LEFT');
  const [pumpedAt, setPumpedAt] = useState<Date>(
    editSession ? new Date(editSession.pumpedAt) : new Date(),
  );
  const [amountMl, setAmountMl] = useState<number>(editSession?.amountMl || 0);
  const [amountText, setAmountText] = useState<string>(
    editSession ? String(editSession.amountMl) : '0',
  );
  const [notes, setNotes] = useState<string>(editSession?.notes || '');
  const [photos, setPhotos] = useState<{ id?: string; uri: string }[]>(
    editSession?.photos?.map((p) => ({ id: p.id, uri: p.url })) || [],
  );
  const [saving, setSaving] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxScrollRef = useRef<ScrollView>(null);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxVisible(true);
    setTimeout(() => {
      lightboxScrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: false });
    }, 50);
  };

  // Date/time editing
  const [editingDate, setEditingDate] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [tempDateStr, setTempDateStr] = useState('');
  const [tempTimeStr, setTempTimeStr] = useState('');

  // Load babies and active baby
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const list = await nursingStorage.getBabies();
        setBabies(list);
        if (!isEditing) {
          const activeId = await nursingStorage.getActiveBabyId();
          if (activeId) setSelectedBabyId(activeId);
        }
      })();
    }, [isEditing])
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatDate = (d: Date) => {
    const day = d.getDate();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${day} ${months[d.getMonth()]}`;
  };

  const formatTime = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const handleAmountChange = (text: string) => {
    setAmountText(text);
    const num = parseFloat(text);
    if (!isNaN(num) && num >= 0) setAmountMl(num);
  };

  const handleAmountBlur = () => {
    setAmountText(String(amountMl));
  };

  const adjustAmount = (delta: number) => {
    const next = Math.max(0, Math.round((amountMl + delta) * 100) / 100);
    setAmountMl(next);
    setAmountText(String(next));
  };

  // Date editing
  const startEditDate = () => {
    const dd = String(pumpedAt.getDate()).padStart(2, '0');
    const mm = String(pumpedAt.getMonth() + 1).padStart(2, '0');
    const yyyy = pumpedAt.getFullYear();
    setTempDateStr(`${dd}/${mm}/${yyyy}`);
    setEditingDate(true);
  };

  const confirmDate = () => {
    const parts = tempDateStr.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const newDate = new Date(pumpedAt);
      newDate.setFullYear(y, m, d);
      if (!isNaN(newDate.getTime())) setPumpedAt(newDate);
    }
    setEditingDate(false);
  };

  const startEditTime = () => {
    const hh = String(pumpedAt.getHours()).padStart(2, '0');
    const mm = String(pumpedAt.getMinutes()).padStart(2, '0');
    setTempTimeStr(`${hh}:${mm}`);
    setEditingTime(true);
  };

  const confirmTime = () => {
    const parts = tempTimeStr.split(':');
    if (parts.length === 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (h >= 0 && h < 24 && m >= 0 && m < 60) {
        const newDate = new Date(pumpedAt);
        newDate.setHours(h, m);
        setPumpedAt(newDate);
      }
    }
    setEditingTime(false);
  };

  // Image picker
  const pickFromGallery = async () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }
    if (!ImagePicker) { Alert.alert('No disponible'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Se necesita acceso a la galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [4, 3], quality: 0.8,
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
      allowsEditing: true, aspect: [4, 3], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, { uri: result.assets[0].uri }]);
    }
  };

  const handleAddPhoto = () => {
    if (photos.length >= 5) {
      Alert.alert('Límite', 'Máximo 5 fotos por sesión.');
      return;
    }
    if (Platform.OS === 'web') {
      pickFromGallery();
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancelar', 'Galería', 'Cámara'], cancelButtonIndex: 0 },
        (idx) => { if (idx === 1) pickFromGallery(); else if (idx === 2) takePhoto(); },
      );
    } else {
      Alert.alert('Agregar foto', '', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Galería', onPress: pickFromGallery },
        { text: 'Cámara', onPress: takePhoto },
      ]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleWebFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uri = URL.createObjectURL(file);
    setPhotos((prev) => [...prev, { uri }]);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (amountMl <= 0) {
      Alert.alert('Cantidad requerida', 'Ingresa la cantidad de ml extraídos.');
      return;
    }

    setSaving(true);
    try {
      let session;
      if (isEditing) {
        session = await updatePumpingSession(editSession!.id, {
          side,
          pumpedAt: pumpedAt.toISOString(),
          amountMl,
          notes: notes.trim() || undefined,
          babyId: selectedBabyId,
        });
      } else {
        session = await createPumpingSession({
          side,
          pumpedAt: pumpedAt.toISOString(),
          amountMl,
          notes: notes.trim() || undefined,
          babyId: selectedBabyId,
        });
      }

      // Upload new photos (those without an id)
      const newPhotos = photos.filter((p) => !p.id);
      for (const photo of newPhotos) {
        try {
          await uploadPumpingPhoto(session.id, photo.uri);
        } catch (err) {
          console.warn('Failed to upload photo:', err);
        }
      }

      // Delete removed photos (those in editSession but not in current photos)
      if (isEditing && editSession?.photos) {
        const currentIds = new Set(photos.filter((p) => p.id).map((p) => p.id));
        for (const orig of editSession.photos) {
          if (!currentIds.has(orig.id)) {
            try {
              await deletePumpingPhoto(editSession.id, orig.id);
            } catch (err) {
              console.warn('Failed to delete photo:', err);
            }
          }
        }
      }

      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo guardar la sesión.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={24} color={colors.slate[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Editar Extracción' : 'Registro de Extracción'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Icon */}
          <View style={styles.iconSection}>
            <View style={styles.iconCircle}>
              <Droplets size={40} color={colors.info} />
            </View>
            <Text style={styles.sectionTitle}>Extracción de Leche</Text>
          </View>

          {/* Side selector */}
          <View style={styles.sideRow}>
            {SIDE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sideButton, side === opt.key && styles.sideButtonActive]}
                onPress={() => setSide(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sideButtonText, side === opt.key && styles.sideButtonTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form card */}
          <View style={styles.card}>
            {/* Date & Time */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldIcon}>
                <Clock size={20} color={colors.slate[400]} />
              </View>
              <Text style={styles.fieldLabel}>Fecha y hora</Text>
              <View style={styles.fieldValueRow}>
                {editingDate ? (
                  <TextInput
                    style={styles.dateInput}
                    value={tempDateStr}
                    onChangeText={setTempDateStr}
                    onBlur={confirmDate}
                    onSubmitEditing={confirmDate}
                    placeholder="DD/MM/AAAA"
                    keyboardType="numbers-and-punctuation"
                    autoFocus
                  />
                ) : (
                  <TouchableOpacity style={styles.dateBadge} onPress={startEditDate}>
                    <Text style={styles.dateBadgeText}>{formatDate(pumpedAt)}</Text>
                  </TouchableOpacity>
                )}
                {editingTime ? (
                  <TextInput
                    style={styles.dateInput}
                    value={tempTimeStr}
                    onChangeText={setTempTimeStr}
                    onBlur={confirmTime}
                    onSubmitEditing={confirmTime}
                    placeholder="HH:MM"
                    keyboardType="numbers-and-punctuation"
                    autoFocus
                  />
                ) : (
                  <TouchableOpacity style={styles.dateBadge} onPress={startEditTime}>
                    <Text style={styles.dateBadgeText}>{formatTime(pumpedAt)}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Baby */}
            {babies.length > 0 && (
              <>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldIcon}>
                    <BabyIcon size={20} color={colors.slate[400]} />
                  </View>
                  <Text style={styles.fieldLabel}>Bebé</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.babyChipsRow}
                >
                  {babies.map((baby) => {
                    const isSelected = selectedBabyId === baby.id;
                    return (
                      <TouchableOpacity
                        key={baby.id}
                        style={[styles.babyChip, isSelected && styles.babyChipSelected]}
                        onPress={() => {
                          const newId = isSelected ? null : baby.id;
                          setSelectedBabyId(newId);
                          nursingStorage.setActiveBabyId(newId);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.babyChipText, isSelected && styles.babyChipTextSelected]}>
                          {baby.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.divider} />
              </>
            )}

            {/* Amount */}
            <View style={styles.amountSection}>
              <TouchableOpacity
                style={styles.amountButton}
                onPress={() => adjustAmount(-AMOUNT_STEP)}
                activeOpacity={0.7}
              >
                <Minus size={22} color={colors.white} />
              </TouchableOpacity>
              <View style={styles.amountCenter}>
                <TextInput
                  style={styles.amountInput}
                  value={amountText}
                  onChangeText={handleAmountChange}
                  onBlur={handleAmountBlur}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
                <Text style={styles.amountUnit}>ml</Text>
              </View>
              <TouchableOpacity
                style={styles.amountButton}
                onPress={() => adjustAmount(AMOUNT_STEP)}
                activeOpacity={0.7}
              >
                <Plus size={22} color={colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Notes */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldIcon}>
                <StickyNote size={20} color={colors.slate[400]} />
              </View>
              <Text style={styles.fieldLabel}>Notas</Text>
            </View>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={(t) => setNotes(t.slice(0, MAX_NOTES))}
              placeholder="Observaciones de esta sesión..."
              placeholderTextColor={colors.slate[300]}
              multiline
              maxLength={MAX_NOTES}
            />
            <Text style={styles.charCount}>{notes.length}/{MAX_NOTES}</Text>

            <View style={styles.divider} />

            {/* Attachments */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldIcon}>
                <Paperclip size={20} color={colors.slate[400]} />
              </View>
              <Text style={styles.fieldLabel}>Adjuntos</Text>
              <View style={styles.attachActions}>
                <TouchableOpacity style={styles.attachButton} onPress={pickFromGallery}>
                  <ImagePlus size={22} color={colors.info} />
                </TouchableOpacity>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity style={styles.attachButton} onPress={takePhoto}>
                    <Camera size={22} color={colors.info} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {photos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photosRow}
                contentContainerStyle={styles.photosContent}
              >
                {photos.map((photo, i) => (
                  <TouchableOpacity key={i} style={styles.photoThumb} activeOpacity={0.8} onPress={() => openLightbox(i)}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => removePhoto(i)}
                    >
                      <X size={14} color={colors.white} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save button */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Guardar</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Hidden file input for web */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef as any}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleWebFileChange}
        />
      )}

      {/* Photo Lightbox */}
      <Modal visible={lightboxVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setLightboxVisible(false)}>
        <View style={styles.lightboxContainer}>
          <StatusBar hidden />
          <ScrollView
            ref={lightboxScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setLightboxIndex(idx);
            }}
            style={styles.lightboxScroll}
          >
            {photos.map((photo, i) => (
              <View key={i} style={styles.lightboxSlide}>
                <Image source={{ uri: photo.uri }} style={styles.lightboxImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
          {photos.length > 1 && (
            <View style={styles.lightboxCounter}>
              <Text style={styles.lightboxCounterText}>{lightboxIndex + 1} / {photos.length}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setLightboxVisible(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      </Modal>
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
    paddingBottom: 120,
  },
  babyChipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  babyChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.slate[50],
    borderWidth: 1.5,
    borderColor: colors.slate[200],
  },
  babyChipSelected: {
    backgroundColor: colors.infoLight,
    borderColor: colors.info,
  },
  babyChipText: {
    ...typography.small,
    color: colors.slate[600],
  },
  babyChipTextSelected: {
    color: colors.info,
    fontWeight: '600',
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.slate[800],
  },
  sideRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  sideButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.slate[200],
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  sideButtonActive: {
    borderColor: colors.info,
    backgroundColor: colors.infoLight,
  },
  sideButtonText: {
    ...typography.bodyBold,
    color: colors.slate[400],
  },
  sideButtonTextActive: {
    color: colors.info,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fieldIcon: {
    width: 28,
    alignItems: 'center',
  },
  fieldLabel: {
    ...typography.body,
    color: colors.slate[600],
    flex: 1,
  },
  fieldValueRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateBadge: {
    backgroundColor: colors.slate[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  dateBadgeText: {
    ...typography.smallBold,
    color: colors.slate[700],
  },
  dateInput: {
    backgroundColor: colors.slate[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    ...typography.smallBold,
    color: colors.slate[700],
    minWidth: 80,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate[100],
    marginVertical: spacing.lg,
  },
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.sm,
  },
  amountButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  amountCenter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.slate[800],
    textAlign: 'center',
    minWidth: 80,
    paddingVertical: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: colors.info,
  },
  amountUnit: {
    ...typography.body,
    color: colors.slate[400],
  },
  notesInput: {
    ...typography.small,
    color: colors.slate[700],
    backgroundColor: colors.slate[50],
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.caption,
    color: colors.slate[300],
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  attachActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photosRow: {
    marginTop: spacing.md,
  },
  photosContent: {
    gap: spacing.sm,
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: radii.sm,
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  saveButton: {
    backgroundColor: colors.info,
    paddingVertical: spacing.lg,
    borderRadius: radii.xl,
    alignItems: 'center',
    ...shadows.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.white,
  },
  lightboxContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  lightboxScroll: { height: Dimensions.get('window').height },
  lightboxSlide: { width: SCREEN_WIDTH, height: Dimensions.get('window').height, justifyContent: 'center', alignItems: 'center' },
  lightboxImage: { width: SCREEN_WIDTH, height: Dimensions.get('window').height },
  lightboxCloseBtn: { position: 'absolute', top: spacing.xxl, right: spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  lightboxCounter: { position: 'absolute', top: spacing.xxl, left: 0, right: 0, alignItems: 'center' },
  lightboxCounterText: { ...typography.smallBold, color: 'rgba(255,255,255,0.7)' },
});
