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
import { Camera } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile, uploadAvatar } from '../services/api';
import { AppHeader, AvatarInitials } from '../components/ui';
import { colors, spacing, typography, radii, shadows } from '../theme';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<any>(null);

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
      await updateUserProfile({ name: name.trim() });
      await updateUser({ name: name.trim() });
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
