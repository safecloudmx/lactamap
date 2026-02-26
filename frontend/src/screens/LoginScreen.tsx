import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Baby, Mail, Lock, User as UserIcon, Eye, EyeOff } from 'lucide-react-native';
import { colors, typography, spacing, radii, shadows } from '../theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, register, guestLogin } = useAuth();
  const insets = useSafeAreaInsets();

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Error de autenticacion';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.xxxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brandSection}>
          <View style={styles.iconCircle}>
            <Baby size={36} color={colors.white} />
          </View>
          <Text style={styles.brandName}>LactaMap</Text>
          <Text style={styles.tagline}>
            Encuentra espacios seguros para ti y tu bebe
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isLogin ? 'Iniciar Sesion' : 'Crear Cuenta'}
          </Text>

          {!isLogin && (
            <View style={styles.inputWrapper}>
              <UserIcon size={18} color={colors.slate[400]} />
              <TextInput
                style={styles.input}
                placeholder="Tu nombre"
                placeholderTextColor={colors.slate[400]}
                value={name}
                onChangeText={setName}
              />
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Mail size={18} color={colors.slate[400]} />
            <TextInput
              style={styles.input}
              placeholder="correo@ejemplo.com"
              placeholderTextColor={colors.slate[400]}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Lock size={18} color={colors.slate[400]} />
            <TextInput
              style={styles.input}
              placeholder="Contrasena"
              placeholderTextColor={colors.slate[400]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? (
                <EyeOff size={18} color={colors.slate[400]} />
              ) : (
                <Eye size={18} color={colors.slate[400]} />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={handleAuth}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isLogin ? 'Iniciar Sesion' : 'Registrarse'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {isLogin ? 'No tienes cuenta? ' : 'Ya tienes cuenta? '}
            </Text>
            <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
              <Text style={styles.switchLink}>
                {isLogin ? 'Registrate' : 'Inicia sesion'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Guest */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.guestBtn} onPress={guestLogin} activeOpacity={0.7}>
          <Text style={styles.guestBtnText}>Continuar como invitado</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[50],
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primary,
    marginBottom: spacing.lg,
  },
  brandName: {
    ...typography.h1,
    color: colors.primary[500],
    marginBottom: spacing.sm,
  },
  tagline: {
    ...typography.small,
    color: colors.slate[500],
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xxl,
    ...shadows.xl,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.slate[800],
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    height: 50,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.slate[800],
  },
  primaryBtn: {
    backgroundColor: colors.primary[500],
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.primary,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    ...typography.button,
    color: colors.white,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  switchLabel: {
    ...typography.small,
    color: colors.slate[600],
  },
  switchLink: {
    ...typography.smallBold,
    color: colors.primary[500],
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xxl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.slate[200],
  },
  dividerText: {
    marginHorizontal: spacing.md,
    ...typography.caption,
    color: colors.slate[400],
  },
  guestBtn: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.slate[200],
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  guestBtnText: {
    ...typography.bodyBold,
    color: colors.slate[600],
  },
});
