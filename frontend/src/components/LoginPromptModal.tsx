import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, TouchableWithoutFeedback,
} from 'react-native';
import { LogIn, X } from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { useAuth } from '../context/AuthContext';

interface LoginPromptModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export default function LoginPromptModal({
  visible,
  onClose,
  title = 'Inicia sesión para continuar',
  message = 'Necesitas una cuenta para usar esta función y guardar tu información de forma segura.',
}: LoginPromptModalProps) {
  const { signOut } = useAuth();

  const handleLogin = async () => {
    onClose();
    // Signing out clears the guest session and the navigator redirects to LoginScreen
    await signOut();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={colors.slate[400]} />
              </TouchableOpacity>

              <View style={styles.iconWrapper}>
                <LogIn size={32} color={colors.primary[500]} />
              </View>

              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} activeOpacity={0.85}>
                <Text style={styles.loginBtnText}>Iniciar sesión</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xxl,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...shadows.lg,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.h4,
    color: colors.slate[800],
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.small,
    color: colors.slate[500],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xxl,
  },
  loginBtn: {
    backgroundColor: colors.primary[500],
    borderRadius: radii.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  loginBtnText: {
    ...typography.button,
    color: colors.white,
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
  },
  cancelBtnText: {
    ...typography.small,
    color: colors.slate[400],
  },
});
