import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirmation dialog.
 * On native: uses Alert.alert with Cancel/Confirm buttons.
 * On web: uses window.confirm since Alert.alert buttons don't work on web.
 */
export function confirmAlert(
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  confirmLabel = 'Eliminar'
): void {
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: () => onConfirm() },
    ]);
  }
}

/**
 * Cross-platform informational alert.
 * On native: uses Alert.alert.
 * On web: uses window.alert.
 */
export function infoAlert(title: string, message: string, onDismiss?: () => void): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    onDismiss?.();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: onDismiss }]);
  }
}
