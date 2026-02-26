import React, { useState } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../services/api';
import { User } from '../types';
import { AppHeader, AvatarInitials } from '../components/ui';
import { colors, spacing, typography, radii, shadows } from '../theme';

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

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
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'No se pudo actualizar el perfil.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Editar Perfil"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <AvatarInitials
              name={name || user?.email || '?'}
              size="xl"
            />
            <Text style={styles.roleText}>
              {user?.role || 'VISITOR'}
            </Text>
          </View>

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
                <Text style={styles.readOnlyText}>
                  {user?.email || ''}
                </Text>
              </View>
              <Text style={styles.helperText}>
                El correo no se puede modificar.
              </Text>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Guardar</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  roleText: {
    ...typography.caption,
    color: colors.slate[400],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  form: {
    gap: spacing.xl,
    marginBottom: spacing.xxxl,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    ...typography.smallBold,
    color: colors.slate[700],
  },
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
  readOnlyText: {
    ...typography.body,
    color: colors.slate[400],
  },
  helperText: {
    ...typography.caption,
    color: colors.slate[400],
  },
  saveButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primary,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.white,
  },
});
