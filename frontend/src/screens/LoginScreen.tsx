import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, Modal,
  TouchableWithoutFeedback, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import {
  Baby, Mail, Lock, User as UserIcon, Eye, EyeOff,
  AlertCircle, CheckCircle, X, ArrowLeft, KeyRound, ShieldCheck,
} from 'lucide-react-native';
import { colors, typography, spacing, radii, shadows } from '../theme';
import api from '../services/api';
import { verifyEmail, resendVerification } from '../services/api';

type AuthMode = 'login' | 'register' | 'verify';
type ResetStep = 'email' | 'otp' | 'newPassword';

interface FieldErrors {
  email?: string;
  password?: string;
  name?: string;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, register, completeAuth, guestLogin } = useAuth();

  // Main auth state
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState('');

  // Email verification state
  const [verifyEmail2, setVerifyEmail2] = useState('');
  const [verifyOtp, setVerifyOtp] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Password reset state
  const [showReset, setShowReset] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  // --- Validation ---
  function validateLogin(): boolean {
    const errs: FieldErrors = {};
    if (!email.trim()) errs.email = 'Ingresa tu correo';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Correo inválido';
    if (!password) errs.password = 'Ingresa tu contraseña';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateRegister(): boolean {
    const errs: FieldErrors = {};
    if (!name.trim() || name.trim().length < 2) errs.name = 'El nombre debe tener al menos 2 caracteres';
    if (!email.trim()) errs.email = 'Ingresa tu correo';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Correo inválido';
    if (!password) errs.password = 'Ingresa una contraseña';
    else if (password.length < 6) errs.password = 'Mínimo 6 caracteres';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleAuth = async () => {
    setGlobalError('');
    const valid = mode === 'login' ? validateLogin() : validateRegister();
    if (!valid) return;

    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await register(email.trim(), password, name.trim());
      }
    } catch (error: any) {
      // Registration requires email verification
      if (error.code === 'REQUIRES_VERIFICATION') {
        setVerifyEmail2(error.email);
        setVerifyOtp('');
        setVerifyError('');
        startResendCooldown();
        setMode('verify');
        return;
      }

      const data = error.response?.data;
      const code = data?.code;
      const msg = data?.error || 'Error de autenticación';

      // Login blocked — redirect to verify screen
      if (code === 'EMAIL_NOT_VERIFIED') {
        setVerifyEmail2(data.email || email.trim());
        setVerifyOtp('');
        setVerifyError('');
        startResendCooldown();
        setMode('verify');
        return;
      }

      if (code === 'USER_NOT_FOUND') {
        setFieldErrors({ email: 'No existe una cuenta con este correo' });
      } else if (code === 'WRONG_PASSWORD') {
        setFieldErrors({ password: msg });
      } else if (code === 'EMAIL_TAKEN') {
        setFieldErrors({ email: 'Este correo ya está registrado' });
      } else if (code === 'INVALID_EMAIL') {
        setFieldErrors({ email: 'Formato de correo inválido' });
      } else if (code === 'WEAK_PASSWORD') {
        setFieldErrors({ password: msg });
      } else {
        setGlobalError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setFieldErrors({});
    setGlobalError('');
    setPassword('');
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleVerifyOtpSubmit = async () => {
    if (verifyOtp.trim().length !== 6) {
      setVerifyError('El código debe tener 6 dígitos');
      return;
    }
    setVerifyLoading(true);
    setVerifyError('');
    try {
      const data = await verifyEmail(verifyEmail2, verifyOtp.trim());
      await completeAuth(data.token, data.user);
    } catch (e: any) {
      const code = e.response?.data?.code;
      if (code === 'OTP_EXPIRED') {
        setVerifyError('El código expiró. Solicita uno nuevo.');
      } else if (code === 'INVALID_OTP') {
        setVerifyError('Código incorrecto. Revisa tu correo.');
      } else {
        setVerifyError(e.response?.data?.error || 'Error al verificar');
      }
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendVerification(verifyEmail2);
      startResendCooldown();
      setVerifyError('');
    } catch {
      setVerifyError('No se pudo reenviar el código');
    }
  };

  // --- Password Reset ---
  const openReset = () => {
    setResetEmail(email);
    setResetOtp('');
    setResetNewPassword('');
    setResetError('');
    setResetSuccess('');
    setResetStep('email');
    setShowReset(true);
  };

  const closeReset = () => {
    setShowReset(false);
    setResetStep('email');
    setResetError('');
    setResetSuccess('');
  };

  const handleSendOtp = async () => {
    if (!resetEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setResetError('Ingresa un correo válido');
      return;
    }
    setResetLoading(true);
    setResetError('');
    try {
      await api.post('/auth/forgot-password', { email: resetEmail.trim() });
      setResetStep('otp');
    } catch (e: any) {
      setResetError(e.response?.data?.error || 'Error al enviar el código');
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyOtp = () => {
    if (resetOtp.trim().length !== 6) {
      setResetError('El código debe tener 6 dígitos');
      return;
    }
    setResetError('');
    setResetStep('newPassword');
  };

  const handleResetPassword = async () => {
    if (resetNewPassword.length < 6) {
      setResetError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setResetLoading(true);
    setResetError('');
    try {
      await api.post('/auth/reset-password', {
        email: resetEmail.trim(),
        otp: resetOtp.trim(),
        newPassword: resetNewPassword,
      });
      setResetSuccess('¡Contraseña actualizada! Ya puedes iniciar sesión.');
      setEmail(resetEmail);
      setPassword('');
      setTimeout(closeReset, 2500);
    } catch (e: any) {
      const code = e.response?.data?.code;
      if (code === 'INVALID_OTP') {
        setResetStep('otp');
        setResetError('Código incorrecto. Verifica e intenta de nuevo.');
      } else if (code === 'OTP_EXPIRED') {
        setResetStep('email');
        setResetError('El código expiró. Solicita uno nuevo.');
      } else {
        setResetError(e.response?.data?.error || 'Error al restablecer la contraseña');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Spinner animation
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    if (loading) {
      spinValue.setValue(0);
      spinAnim.current = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinAnim.current.start();
    } else {
      spinAnim.current?.stop();
    }
  }, [loading]);
  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // --- Render helpers ---
  const renderFieldError = (msg?: string) =>
    msg ? (
      <View style={styles.fieldError}>
        <AlertCircle size={13} color={colors.error} />
        <Text style={styles.fieldErrorText}>{msg}</Text>
      </View>
    ) : null;

  const inputStyle = (field: string, hasError?: boolean) => [
    styles.inputWrapper,
    hasError && styles.inputWrapperError,
    focusedField === field && !hasError && styles.inputWrapperFocused,
  ];

  const stepsDone = { otp: ['email'], newPassword: ['email', 'otp'] } as Record<string, string[]>;

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
          <Text style={styles.tagline}>Encuentra espacios seguros para ti y tu bebé</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>

          {/* ── Verify email mode ── */}
          {mode === 'verify' ? (
            <>
              <View style={styles.verifyIconRow}>
                <ShieldCheck size={36} color={colors.primary[500]} />
              </View>
              <Text style={styles.cardTitle}>Verifica tu correo</Text>
              <Text style={styles.verifyDesc}>
                Enviamos un código de 6 dígitos a{'\n'}
                <Text style={styles.verifyEmail}>{verifyEmail2}</Text>
              </Text>

              <TextInput
                style={[styles.otpInput, !!verifyError && { borderColor: colors.error }]}
                placeholder="000000"
                placeholderTextColor={colors.slate[300]}
                value={verifyOtp}
                onChangeText={(t) => { setVerifyOtp(t.replace(/\D/g, '').slice(0, 6)); setVerifyError(''); }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                onSubmitEditing={handleVerifyOtpSubmit}
              />

              {!!verifyError && (
                <View style={styles.globalError}>
                  <AlertCircle size={14} color={colors.error} />
                  <Text style={styles.globalErrorText}>{verifyError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, verifyLoading && styles.primaryBtnLoading]}
                onPress={handleVerifyOtpSubmit}
                disabled={verifyLoading}
                activeOpacity={0.85}
              >
                {verifyLoading ? (
                  <View style={styles.loadingRow}>
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                      <View style={styles.spinnerRing} />
                    </Animated.View>
                    <Text style={styles.primaryBtnText}>Verificando...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryBtnText}>Verificar cuenta</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleResendVerification}
                disabled={resendCooldown > 0}
              >
                <Text style={[styles.resendBtnText, resendCooldown > 0 && { color: colors.slate[400] }]}>
                  {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.backToLogin} onPress={() => setMode('login')}>
                <ArrowLeft size={14} color={colors.slate[400]} />
                <Text style={styles.backToLoginText}>Volver al inicio de sesión</Text>
              </TouchableOpacity>
            </>
          ) : (

          <><Text style={styles.cardTitle}>
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </Text>

          {mode === 'register' && (
            <>
              <View style={inputStyle('name', !!fieldErrors.name)}>
                <UserIcon size={18} color={fieldErrors.name ? colors.error : focusedField === 'name' ? colors.primary[500] : colors.slate[400]} />
                <TextInput
                  style={styles.input}
                  placeholder="Tu nombre"
                  placeholderTextColor={colors.slate[400]}
                  value={name}
                  onChangeText={(t) => { setName(t); setFieldErrors((p) => ({ ...p, name: undefined })); }}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
              </View>
              {renderFieldError(fieldErrors.name)}
            </>
          )}

          <View style={inputStyle('email', !!fieldErrors.email)}>
            <Mail size={18} color={fieldErrors.email ? colors.error : focusedField === 'email' ? colors.primary[500] : colors.slate[400]} />
            <TextInput
              style={styles.input}
              placeholder="correo@ejemplo.com"
              placeholderTextColor={colors.slate[400]}
              value={email}
              onChangeText={(t) => { setEmail(t); setFieldErrors((p) => ({ ...p, email: undefined })); }}
              autoCapitalize="none"
              keyboardType="email-address"
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              returnKeyType="next"
              blurOnSubmit={false}
            />
          </View>
          {renderFieldError(fieldErrors.email)}

          <View style={inputStyle('password', !!fieldErrors.password)}>
            <Lock size={18} color={fieldErrors.password ? colors.error : focusedField === 'password' ? colors.primary[500] : colors.slate[400]} />
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              placeholderTextColor={colors.slate[400]}
              value={password}
              onChangeText={(t) => { setPassword(t); setFieldErrors((p) => ({ ...p, password: undefined })); }}
              secureTextEntry={!showPassword}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              returnKeyType="done"
              onSubmitEditing={handleAuth}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {showPassword ? <EyeOff size={18} color={colors.slate[400]} /> : <Eye size={18} color={colors.slate[400]} />}
            </TouchableOpacity>
          </View>
          {renderFieldError(fieldErrors.password)}

          {mode === 'login' && (
            <TouchableOpacity style={styles.forgotLink} onPress={openReset}>
              <Text style={styles.forgotLinkText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          )}

          {!!globalError && (
            <View style={styles.globalError}>
              <AlertCircle size={16} color={colors.error} />
              <Text style={styles.globalErrorText}>{globalError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnLoading]}
            onPress={handleAuth}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <View style={styles.spinnerRing} />
                </Animated.View>
                <Text style={styles.primaryBtnText}>
                  {mode === 'login' ? 'Iniciando sesión...' : 'Creando cuenta...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>{mode === 'login' ? 'Iniciar Sesión' : 'Registrarse'}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}</Text>
            <TouchableOpacity onPress={switchMode}>
              <Text style={styles.switchLink}>{mode === 'login' ? 'Regístrate' : 'Inicia sesión'}</Text>
            </TouchableOpacity>
          </View>
          </>)}

        </View>

        {mode !== 'verify' && (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>
            <TouchableOpacity style={styles.guestBtn} onPress={guestLogin} activeOpacity={0.7}>
              <Text style={styles.guestBtnText}>Continuar como invitado</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* ===== Password Reset Modal ===== */}
      <Modal visible={showReset} transparent animationType="slide" onRequestClose={closeReset}>
        <TouchableWithoutFeedback onPress={closeReset}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.xxl }]}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  {resetStep !== 'email' && !resetSuccess ? (
                    <TouchableOpacity
                      onPress={() => { setResetStep(resetStep === 'otp' ? 'email' : 'otp'); setResetError(''); }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <ArrowLeft size={22} color={colors.slate[600]} />
                    </TouchableOpacity>
                  ) : <View style={{ width: 22 }} />}
                  <Text style={styles.modalTitle}>
                    {resetStep === 'email' && 'Recuperar contraseña'}
                    {resetStep === 'otp' && 'Verifica tu código'}
                    {resetStep === 'newPassword' && 'Nueva contraseña'}
                  </Text>
                  <TouchableOpacity onPress={closeReset} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={22} color={colors.slate[400]} />
                  </TouchableOpacity>
                </View>

                {/* Success */}
                {!!resetSuccess ? (
                  <View style={styles.resetSuccessBox}>
                    <CheckCircle size={48} color={colors.success} />
                    <Text style={styles.resetSuccessText}>{resetSuccess}</Text>
                  </View>
                ) : (
                  <>
                    {/* Step indicator */}
                    <View style={styles.stepRow}>
                      {(['email', 'otp', 'newPassword'] as ResetStep[]).map((s, i) => {
                        const isDone = stepsDone[resetStep]?.includes(s);
                        const isActive = resetStep === s;
                        return (
                          <View key={s} style={styles.stepItem}>
                            <View style={[styles.stepDot, isActive && styles.stepDotActive, isDone && styles.stepDotDone]} />
                            {i < 2 && <View style={[styles.stepLine, isDone && styles.stepLineDone]} />}
                          </View>
                        );
                      })}
                    </View>

                    {/* Step: Email */}
                    {resetStep === 'email' && (
                      <>
                        <Text style={styles.resetDesc}>
                          Ingresa el correo de tu cuenta y te enviaremos un código de 6 dígitos.
                        </Text>
                        <View style={[styles.inputWrapper, !!resetError && styles.inputWrapperError]}>
                          <Mail size={18} color={colors.slate[400]} />
                          <TextInput
                            style={styles.input}
                            placeholder="correo@ejemplo.com"
                            placeholderTextColor={colors.slate[400]}
                            value={resetEmail}
                            onChangeText={(t) => { setResetEmail(t); setResetError(''); }}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            autoFocus
                          />
                        </View>
                      </>
                    )}

                    {/* Step: OTP */}
                    {resetStep === 'otp' && (
                      <>
                        <Text style={styles.resetDesc}>
                          Ingresa el código de 6 dígitos enviado a{' '}
                          <Text style={{ fontWeight: '600', color: colors.slate[800] }}>{resetEmail}</Text>.
                        </Text>
                        <TextInput
                          style={[styles.otpInput, !!resetError && { borderColor: colors.error }]}
                          placeholder="000000"
                          placeholderTextColor={colors.slate[300]}
                          value={resetOtp}
                          onChangeText={(t) => { setResetOtp(t.replace(/\D/g, '').slice(0, 6)); setResetError(''); }}
                          keyboardType="number-pad"
                          maxLength={6}
                          autoFocus
                        />
                        <TouchableOpacity onPress={handleSendOtp} style={styles.resendLink}>
                          <Text style={styles.resendLinkText}>Reenviar código</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {/* Step: New Password */}
                    {resetStep === 'newPassword' && (
                      <>
                        <Text style={styles.resetDesc}>Elige una nueva contraseña para tu cuenta.</Text>
                        <View style={[styles.inputWrapper, !!resetError && styles.inputWrapperError]}>
                          <KeyRound size={18} color={colors.slate[400]} />
                          <TextInput
                            style={styles.input}
                            placeholder="Nueva contraseña (mín. 6 caracteres)"
                            placeholderTextColor={colors.slate[400]}
                            value={resetNewPassword}
                            onChangeText={(t) => { setResetNewPassword(t); setResetError(''); }}
                            secureTextEntry={!showResetPassword}
                            autoFocus
                          />
                          <TouchableOpacity onPress={() => setShowResetPassword(!showResetPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            {showResetPassword ? <EyeOff size={18} color={colors.slate[400]} /> : <Eye size={18} color={colors.slate[400]} />}
                          </TouchableOpacity>
                        </View>
                      </>
                    )}

                    {/* Error */}
                    {!!resetError && (
                      <View style={styles.resetErrorBox}>
                        <AlertCircle size={14} color={colors.error} />
                        <Text style={styles.resetErrorText}>{resetError}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.primaryBtn, { marginTop: spacing.lg }, resetLoading && styles.primaryBtnDisabled]}
                      onPress={resetStep === 'email' ? handleSendOtp : resetStep === 'otp' ? handleVerifyOtp : handleResetPassword}
                      disabled={resetLoading}
                      activeOpacity={0.85}
                    >
                      {resetLoading
                        ? <ActivityIndicator color={colors.white} />
                        : <Text style={styles.primaryBtnText}>
                            {resetStep === 'email' && 'Enviar código'}
                            {resetStep === 'otp' && 'Verificar código'}
                            {resetStep === 'newPassword' && 'Actualizar contraseña'}
                          </Text>}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary[50] },
  scrollContent: {
    flexGrow: 1, paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxxl,
  },
  brandSection: { alignItems: 'center', marginBottom: spacing.xxxl },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary[500],
    alignItems: 'center', justifyContent: 'center',
    ...shadows.primary, marginBottom: spacing.lg,
  },
  brandName: { ...typography.h1, color: colors.primary[500], marginBottom: spacing.sm },
  tagline: { ...typography.small, color: colors.slate[500], textAlign: 'center' },

  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.xxl, ...shadows.xl },
  cardTitle: { ...typography.h3, color: colors.slate[800], marginBottom: spacing.xl, textAlign: 'center' },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.slate[50],
    borderWidth: 1, borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    height: 50, gap: spacing.sm,
  },
  inputWrapperError: { borderColor: colors.error, backgroundColor: '#FFF5F5' },
  inputWrapperFocused: {
    borderColor: colors.primary[400],
    backgroundColor: colors.white,
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  input: { flex: 1, fontSize: 16, color: colors.slate[800], outlineStyle: 'none' } as any,

  fieldError: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm, marginTop: 2 },
  fieldErrorText: { ...typography.caption, color: colors.error },

  forgotLink: { alignSelf: 'flex-end', marginBottom: spacing.md, marginTop: spacing.xs },
  forgotLinkText: { ...typography.caption, color: colors.primary[500], fontWeight: '600' },

  globalError: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: '#FFF5F5', borderRadius: radii.md,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.error + '40',
  },
  globalErrorText: { ...typography.small, color: colors.error, flex: 1 },

  primaryBtn: {
    backgroundColor: colors.primary[500], paddingVertical: 14,
    borderRadius: radii.md, alignItems: 'center', marginTop: spacing.sm, ...shadows.primary,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnLoading: { opacity: 0.9 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spinnerRing: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderTopColor: colors.white,
  },
  primaryBtnText: { ...typography.button, color: colors.white },

  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  switchLabel: { ...typography.small, color: colors.slate[600] },
  switchLink: { ...typography.smallBold, color: colors.primary[500] },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xxl },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.slate[200] },
  dividerText: { marginHorizontal: spacing.md, ...typography.caption, color: colors.slate[400] },

  guestBtn: {
    backgroundColor: colors.white, borderWidth: 1.5,
    borderColor: colors.slate[200], paddingVertical: 14,
    borderRadius: radii.md, alignItems: 'center', ...shadows.sm,
  },
  guestBtnText: { ...typography.bodyBold, color: colors.slate[600] },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl,
    padding: spacing.xxl, minHeight: 380,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.xl,
  },
  modalTitle: { ...typography.h4, color: colors.slate[800] },

  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.slate[200] },
  stepDotActive: { backgroundColor: colors.primary[500], transform: [{ scale: 1.3 }] },
  stepDotDone: { backgroundColor: colors.success },
  stepLine: { width: 40, height: 2, backgroundColor: colors.slate[200], marginHorizontal: 4 },
  stepLineDone: { backgroundColor: colors.success },

  resetDesc: { ...typography.small, color: colors.slate[600], marginBottom: spacing.lg, lineHeight: 20 },
  otpInput: {
    ...typography.h1, textAlign: 'center', letterSpacing: 14,
    borderWidth: 2, borderColor: colors.primary[200],
    borderRadius: radii.md, paddingVertical: spacing.lg,
    color: colors.primary[600], backgroundColor: colors.primary[50], marginBottom: spacing.md,
  },
  resendLink: { alignSelf: 'center', paddingVertical: spacing.xs },
  resendLinkText: { ...typography.small, color: colors.primary[500], fontWeight: '600' },

  resetErrorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: '#FFF5F5', borderRadius: radii.md,
    padding: spacing.md, marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.error + '40',
  },
  resetErrorText: { ...typography.caption, color: colors.error, flex: 1 },

  resetSuccessBox: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxxl },
  resetSuccessText: { ...typography.body, color: colors.success, textAlign: 'center', fontWeight: '600' },

  // Email verification screen
  verifyIconRow: { alignItems: 'center', marginBottom: spacing.md },
  verifyDesc: { ...typography.small, color: colors.slate[500], textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
  verifyEmail: { fontWeight: '700', color: colors.slate[700] },
  resendBtn: { alignSelf: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
  resendBtnText: { ...typography.small, color: colors.primary[500], fontWeight: '600' },
  backToLogin: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md },
  backToLoginText: { ...typography.caption, color: colors.slate[400] },
});
