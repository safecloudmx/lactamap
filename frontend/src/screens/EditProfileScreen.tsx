import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera, CalendarDays } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile, uploadAvatar } from '../services/api';
import { AppHeader, AvatarInitials } from '../components/ui';
import { UserSex } from '../types';
import { colors, spacing, typography, radii, shadows } from '../theme';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

type SexOption = { key: UserSex; label: string };
const SEX_OPTIONS: SexOption[] = [
  { key: null, label: 'No especificar' },
  { key: 'F', label: 'Mujer' },
  { key: 'M', label: 'Hombre' },
];

function formatDateDisplay(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

function toDateInputValue(isoString: string | null | undefined): string {
  if (!isoString) return '';
  return new Date(isoString).toISOString().slice(0, 10);
}

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [sex, setSex] = useState<UserSex>(user?.sex ?? null);
  const [birthDate, setBirthDate] = useState<string | null>(user?.birthDate ?? null);
  const [saving, setSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<any>(null);
  const dateInputRef = useRef<any>(null);

  const currentAvatar = avatarUri || user?.avatarUrl || null;

  const handlePickAvatarWeb = () => {
    fileInputRef.current?.click();
  };

  const handlePickAvatarNative = async () => {
    if (!ImagePicker) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadAvatarImage(result.assets[0].uri);
    }
  };

  const handleAvatarPress = () => {
    if (Platform.OS === 'web') {
      handlePickAvatarWeb();
    } else {
      handlePickAvatarNative();
    }
  };

  const uploadAvatarImage = async (uri: string) => {
    setUploadingAvatar(true);
    setAvatarUri(uri); // Show preview immediately
    try {
      const { avatarUrl } = await uploadAvatar(uri);
      await updateUser({ avatarUrl });
      setAvatarUri(avatarUrl); // Replace local URI with S3 URL
    } catch {
      Alert.alert('Error', 'No se pudo subir la foto de perfil.');
      setAvatarUri(null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (name.trim().length === 0) {
      Alert.alert('Error', 'El nombre no puede estar vacio.');
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile({
        name: name.trim(),
        sex,
        birthDate,
      });
      await updateUser({ name: name.trim(), sex, birthDate });
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Editar Perfil" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* Avatar with camera button */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrapper} onPress={handleAvatarPress} activeOpacity={0.8}>
              <AvatarInitials
                name={name || user?.email || '?'}
                size="xl"
                imageUrl={currentAvatar}
              />
              <View style={styles.cameraOverlay}>
                {uploadingAvatar
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Camera size={16} color={colors.white} />
                }
              </View>
            </TouchableOpacity>
            <Text style={styles.roleText}>{user?.role || 'VISITOR'}</Text>
            <Text style={styles.changePhotoHint}>Toca para cambiar foto</Text>
          </View>

          {/* Hidden web file input */}
          {Platform.OS === 'web' && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' } as any}
              onChange={async (e: any) => {
                const file = e.target.files?.[0];
                if (file) await uploadAvatarImage(URL.createObjectURL(file));
                e.target.value = '';
              }}
            />
          )}

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Tu nombre"
                placeholderTextColor={colors.slate[400]}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Correo electronico</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>{user?.email || ''}</Text>
              </View>
              <Text style={styles.helperText}>El correo no se puede modificar.</Text>
            </View>

            {/* Sex selector */}
            <View style={styles.field}>
              <Text style={styles.label}>Sexo <Text style={styles.optionalTag}>(opcional)</Text></Text>
              <View style={styles.sexRow}>
                {SEX_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={String(opt.key)}
                    style={[styles.sexOption, sex === opt.key && styles.sexOptionSelected]}
                    onPress={() => setSex(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.sexLabel, sex === opt.key && styles.sexLabelSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.helperText}>
                Esto personaliza los textos de la app para ti.
              </Text>
            </View>

            {/* Birth date */}
            <View style={styles.field}>
              <Text style={styles.label}>Fecha de nacimiento <Text style={styles.optionalTag}>(opcional)</Text></Text>
              {Platform.OS === 'web' ? (
                <View style={styles.dateInputWrapper}>
                  <CalendarDays size={18} color={colors.slate[400]} />
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={toDateInputValue(birthDate)}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e: any) => {
                      const val = e.target.value;
                      setBirthDate(val ? new Date(val + 'T00:00:00').toISOString() : null);
                    }}
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 15,
                      color: '#1e293b',
                      fontFamily: 'inherit',
                    } as any}
                  />
                </View>
              ) : (
                <TouchableOpacity style={styles.dateInputWrapper} activeOpacity={0.7}>
                  <CalendarDays size={18} color={colors.slate[400]} />
                  <Text style={[styles.dateText, !birthDate && styles.datePlaceholder]}>
                    {birthDate ? formatDateDisplay(birthDate) : 'Seleccionar fecha'}
                  </Text>
                </TouchableOpacity>
              )}
              {birthDate && (
                <TouchableOpacity onPress={() => setBirthDate(null)}>
                  <Text style={styles.clearDateText}>Borrar fecha</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.saveButtonText}>Guardar</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate[50] },
  flex: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  avatarSection: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  avatarWrapper: { position: 'relative' },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  roleText: {
    ...typography.caption,
    color: colors.slate[400],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  changePhotoHint: {
    ...typography.caption,
    color: colors.slate[400],
  },
  form: { gap: spacing.xl, marginBottom: spacing.xxxl },
  field: { gap: spacing.sm },
  label: { ...typography.smallBold, color: colors.slate[700] },
  input: {
    ...typography.body,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.slate[800],
    ...shadows.sm,
  },
  readOnlyInput: {
    backgroundColor: colors.slate[100],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  readOnlyText: { ...typography.body, color: colors.slate[400] },
  helperText: { ...typography.caption, color: colors.slate[400] },
  optionalTag: { ...typography.caption, color: colors.slate[400], fontWeight: '400' },
  sexRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sexOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  sexOptionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  sexLabel: {
    ...typography.smallBold,
    color: colors.slate[600],
  },
  sexLabelSelected: {
    color: colors.primary[700],
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  dateText: {
    ...typography.body,
    color: colors.slate[800],
    flex: 1,
  },
  datePlaceholder: {
    color: colors.slate[400],
  },
  clearDateText: {
    ...typography.caption,
    color: colors.primary[500],
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primary,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { ...typography.button, color: colors.white },
});
