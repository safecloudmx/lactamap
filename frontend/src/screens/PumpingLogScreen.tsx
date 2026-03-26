import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Image, Alert, StyleSheet, Platform, ActivityIndicator,
  ActionSheetIOS, KeyboardAvoidingView, Modal, Dimensions, StatusBar,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft, Minus, Plus, Camera, ImagePlus, X, Clock,
  StickyNote, Paperclip, Droplets, Baby as BabyIcon,
  Snowflake, Thermometer, CheckCircle, Sun, Moon, Info, Lock,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii, shadows } from '../theme';
import {
  createPumpingSession, updatePumpingSession,
  uploadPumpingPhoto, deletePumpingPhoto,
} from '../services/api';
import { PumpingSide, PumpingSession, Baby, StorageStatus, PumpingClassification } from '../types';
import * as nursingStorage from '../services/nursingStorage';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

const SIDE_OPTIONS: { key: PumpingSide; label: string }[] = [
  { key: 'LEFT', label: 'Izquierdo' },
  { key: 'BOTH', label: 'Ambos' },
  { key: 'RIGHT', label: 'Derecho' },
];

const STORAGE_OPTIONS: { key: StorageStatus; label: string; icon: any; color: string }[] = [
  { key: 'FROZEN', label: 'Congelado', icon: Snowflake, color: '#3b82f6' },
  { key: 'REFRIGERATED', label: 'Refrigerado', icon: Thermometer, color: '#06b6d4' },
  { key: 'CONSUMED', label: 'Consumido', icon: CheckCircle, color: '#22c55e' },
];

const AMOUNT_STEP = 5;
const MAX_NOTES = 3000;
const SCREEN_WIDTH = Dimensions.get('window').width;

function calculateDefaultExpiration(status: StorageStatus, refDate: Date): Date | null {
  if (status === 'CONSUMED') return null;
  const d = new Date(refDate);
  if (status === 'FROZEN') d.setMonth(d.getMonth() + 4);
  else if (status === 'REFRIGERATED') d.setDate(d.getDate() + 4);
  return d;
}

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

  // New fields
  const [storageStatus, setStorageStatus] = useState<StorageStatus>(editSession?.storageStatus || 'FROZEN');
  const [classification, setClassification] = useState<PumpingClassification | null>(editSession?.classification || null);
  const [customExpiration, setCustomExpiration] = useState<Date | null>(
    editSession?.expirationDate ? new Date(editSession.expirationDate) : null,
  );

  // Calculate effective expiration
  const effectiveExpiration = useMemo(() => {
    if (customExpiration) return customExpiration;
    return calculateDefaultExpiration(storageStatus, pumpedAt);
  }, [customExpiration, storageStatus, pumpedAt]);

  // 15-minute lock for core fields when editing
  const isLocked = useMemo(() => {
    if (!isEditing || !editSession?.createdAt) return false;
    const created = new Date(editSession.createdAt).getTime();
    const now = Date.now();
    return now - created > 15 * 60 * 1000;
  }, [isEditing, editSession?.createdAt]);

  const showLockedAlert = () => {
    Alert.alert(
      'Campo bloqueado',
      'Los registros no pueden ser modificados pasando los 15 minutos de su creación.',
    );
  };

  // 4-4-4 info modal
  const [infoModalVisible, setInfoModalVisible] = useState(false);

  // Expiration editing
  const [editingExpiration, setEditingExpiration] = useState(false);
  const [tempExpStr, setTempExpStr] = useState('');

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

  const formatFullDate = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
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

  // Expiration editing
  const startEditExpiration = () => {
    if (effectiveExpiration) {
      setTempExpStr(formatFullDate(effectiveExpiration));
    } else {
      setTempExpStr('');
    }
    setEditingExpiration(true);
  };

  const confirmExpiration = () => {
    const parts = tempExpStr.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const newDate = new Date(y, m, d);
      if (!isNaN(newDate.getTime())) {
        setCustomExpiration(newDate);
      }
    }
    setEditingExpiration(false);
  };

  const resetExpiration = () => {
    setCustomExpiration(null);
  };

  const handleStorageChange = (newStatus: StorageStatus) => {
    setStorageStatus(newStatus);
    // Reset custom expiration when storage changes
    setCustomExpiration(null);
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
      const commonData = {
        side,
        pumpedAt: pumpedAt.toISOString(),
        amountMl,
        notes: notes.trim() || undefined,
        babyId: selectedBabyId,
        storageStatus,
        expirationDate: effectiveExpiration?.toISOString() || undefined,
        classification: classification || undefined,
      };

      if (isEditing) {
        session = await updatePumpingSession(editSession!.id, commonData);
      } else {
        session = await createPumpingSession(commonData);
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
                style={[styles.sideButton, side === opt.key && styles.sideButtonActive, isLocked && styles.lockedField]}
                onPress={() => isLocked ? showLockedAlert() : setSide(opt.key)}
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
                  <TouchableOpacity style={[styles.dateBadge, isLocked && styles.lockedField]} onPress={() => isLocked ? showLockedAlert() : startEditDate()}>
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
                  <TouchableOpacity style={[styles.dateBadge, isLocked && styles.lockedField]} onPress={() => isLocked ? showLockedAlert() : startEditTime()}>
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
                        style={[styles.babyChip, isSelected && styles.babyChipSelected, isLocked && styles.lockedField]}
                        onPress={() => {
                          if (isLocked) { showLockedAlert(); return; }
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
                style={[styles.amountButton, isLocked && { opacity: 0.4 }]}
                onPress={() => isLocked ? showLockedAlert() : adjustAmount(-AMOUNT_STEP)}
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
                  editable={!isLocked}
                  onTouchStart={isLocked ? showLockedAlert : undefined}
                />
                <Text style={styles.amountUnit}>ml</Text>
              </View>
              <TouchableOpacity
                style={[styles.amountButton, isLocked && { opacity: 0.4 }]}
                onPress={() => isLocked ? showLockedAlert() : adjustAmount(AMOUNT_STEP)}
                activeOpacity={0.7}
              >
                <Plus size={22} color={colors.white} />
              </TouchableOpacity>
            </View>
            {isLocked && (
              <View style={styles.lockedBanner}>
                <Lock size={14} color={colors.slate[400]} />
                <Text style={styles.lockedBannerText}>
                  Los campos principales se bloquean 15 min después de creados
                </Text>
              </View>
            )}
          </View>

          {/* Consumption card */}
          <View style={[styles.card, { marginTop: spacing.lg }]}>
            <Text style={styles.cardSectionTitle}>Consumo</Text>

            {/* Storage status */}
            <View style={styles.storageRow}>
              {STORAGE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = storageStatus === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.storageChip,
                      selected && { backgroundColor: opt.color + '15', borderColor: opt.color },
                    ]}
                    onPress={() => handleStorageChange(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Icon size={16} color={selected ? opt.color : colors.slate[400]} />
                    <Text style={[
                      styles.storageChipText,
                      selected && { color: opt.color, fontWeight: '600' },
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Expiration */}
            {storageStatus !== 'CONSUMED' && effectiveExpiration && (
              <>
                <View style={styles.divider} />
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Expiración</Text>
                  <View style={styles.fieldValueRow}>
                    {editingExpiration ? (
                      <TextInput
                        style={styles.dateInput}
                        value={tempExpStr}
                        onChangeText={setTempExpStr}
                        onBlur={confirmExpiration}
                        onSubmitEditing={confirmExpiration}
                        placeholder="DD/MM/AAAA"
                        keyboardType="numbers-and-punctuation"
                        autoFocus
                      />
                    ) : (
                      <TouchableOpacity style={styles.dateBadge} onPress={startEditExpiration}>
                        <Text style={styles.dateBadgeText}>{formatFullDate(effectiveExpiration)}</Text>
                      </TouchableOpacity>
                    )}
                    {customExpiration && (
                      <TouchableOpacity onPress={resetExpiration} style={styles.resetBtn}>
                        <X size={14} color={colors.slate[400]} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={styles.expirationHintRow}>
                  <Text style={styles.expirationHint}>
                    {(() => {
                      if (!effectiveExpiration) return '';
                      const days = Math.ceil((effectiveExpiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      if (days <= 0) return 'Expirado';
                      return `${days} día${days !== 1 ? 's' : ''} restante${days !== 1 ? 's' : ''}`;
                    })()}
                    {customExpiration ? ' (personalizado)' : ''}
                  </Text>
                  <TouchableOpacity onPress={() => setInfoModalVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <View style={styles.infoLink}>
                      <Info size={13} color={colors.info} />
                      <Text style={styles.infoLinkText}>Regla 4-4-4</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Classification */}
            <View style={styles.divider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Clasificación (opcional)</Text>
              <View style={styles.classificationRow}>
                <TouchableOpacity
                  style={[
                    styles.classChip,
                    classification === 'DAY' && styles.classChipDayActive,
                  ]}
                  onPress={() => setClassification(classification === 'DAY' ? null : 'DAY')}
                >
                  <Sun size={14} color={classification === 'DAY' ? '#f59e0b' : colors.slate[400]} />
                  <Text style={[
                    styles.classChipText,
                    classification === 'DAY' && { color: '#f59e0b' },
                  ]}>Día</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.classChip,
                    classification === 'NIGHT' && styles.classChipNightActive,
                  ]}
                  onPress={() => setClassification(classification === 'NIGHT' ? null : 'NIGHT')}
                >
                  <Moon size={14} color={classification === 'NIGHT' ? '#6366f1' : colors.slate[400]} />
                  <Text style={[
                    styles.classChipText,
                    classification === 'NIGHT' && { color: '#6366f1' },
                  ]}>Noche</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Notes & Attachments card */}
          <View style={[styles.card, { marginTop: spacing.lg }]}>
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

      {/* 4-4-4 Info Modal */}
      <Modal visible={infoModalVisible} transparent animationType="fade" onRequestClose={() => setInfoModalVisible(false)}>
        <View style={styles.infoModalOverlay}>
          <View style={styles.infoModalContent}>
            <View style={styles.infoModalHeader}>
              <Text style={styles.infoModalTitle}>Regla 4-4-4 para leche materna</Text>
              <TouchableOpacity onPress={() => setInfoModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={20} color={colors.slate[500]} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.infoModalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.infoModalText}>
                La regla 4-4-4 es una guía práctica para almacenar leche materna de forma segura:{'\n\n'}
                <Text style={{ fontWeight: '700', color: '#f59e0b' }}>4 horas</Text> a temperatura ambiente (hasta 25 °C).{'\n'}
                <Text style={{ fontWeight: '700', color: '#06b6d4' }}>4 días</Text> en el refrigerador (0–4 °C).{'\n'}
                <Text style={{ fontWeight: '700', color: '#3b82f6' }}>4 meses</Text> en el congelador (−18 °C o menos).{'\n\n'}
                Algunos estudios indican que la leche congelada puede durar hasta 6–12 meses, pero su calidad nutricional disminuye con el tiempo. Siempre etiqueta cada recipiente con la fecha y hora de extracción.{'\n\n'}
                Una vez descongelada, la leche debe usarse dentro de las 24 horas siguientes y <Text style={{ fontWeight: '700' }}>nunca debe volver a congelarse</Text>.{'\n\n'}
                <Text style={{ fontStyle: 'italic', color: colors.slate[400] }}>Esta información es orientativa. Consulta siempre con tu pediatra o profesional de salud para recomendaciones específicas.</Text>
              </Text>
            </ScrollView>
          </View>
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
  cardSectionTitle: {
    ...typography.bodyBold,
    color: colors.slate[800],
    marginBottom: spacing.md,
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
    alignItems: 'center',
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
    minWidth: 60,
    maxWidth: 150,
    paddingVertical: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: colors.info,
  },
  amountUnit: {
    ...typography.body,
    color: colors.slate[400],
    flexShrink: 0,
  },
  // Storage status
  storageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  storageChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
  },
  storageChipText: {
    ...typography.caption,
    color: colors.slate[500],
  },
  // Classification
  classificationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  classChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
  },
  classChipDayActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  classChipNightActive: {
    backgroundColor: '#e0e7ff',
    borderColor: '#6366f1',
  },
  classChipText: {
    ...typography.caption,
    color: colors.slate[500],
  },
  expirationHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  expirationHint: {
    ...typography.caption,
    color: colors.slate[400],
  },
  infoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  infoLinkText: {
    ...typography.caption,
    color: colors.info,
    fontWeight: '600',
  },
  resetBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
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
  // Lock styles
  lockedField: {
    opacity: 0.5,
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.slate[50],
    borderRadius: radii.sm,
  },
  lockedBannerText: {
    ...typography.caption,
    color: colors.slate[400],
    flex: 1,
  },
  // 4-4-4 Info Modal
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  infoModalContent: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    ...shadows.lg,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  infoModalTitle: {
    ...typography.h4,
    color: colors.slate[800],
    flex: 1,
  },
  infoModalScroll: {
    flexGrow: 0,
  },
  infoModalText: {
    ...typography.body,
    color: colors.slate[600],
    lineHeight: 22,
  },
});
