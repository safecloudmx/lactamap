import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import {
  UserPen,
  Bell,
  BellOff,
  Info,
  FileText,
  Shield,
  ChevronRight,
} from 'lucide-react-native';
import { AppHeader } from '../components/ui';
import { colors, spacing, typography, radii, shadows } from '../theme';

const NOTIFICATIONS_KEY = '@Settings:notifications';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(NOTIFICATIONS_KEY).then((val) => {
      if (val !== null) setNotificationsEnabled(val === 'true');
    });
  }, []);

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, String(value));
  };

  const renderSectionHeader = (title: string) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  const renderRow = (props: {
    icon: React.ReactNode;
    label: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    showChevron?: boolean;
  }) => {
    const { icon, label, onPress, rightElement, showChevron = true } = props;
    const Container = onPress ? TouchableOpacity : View;
    return (
      <Container
        style={styles.row}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.rowIcon}>{icon}</View>
        <Text style={styles.rowLabel}>{label}</Text>
        {rightElement || (showChevron && onPress && (
          <ChevronRight size={20} color={colors.slate[300]} />
        ))}
      </Container>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Configuracion"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Account Section */}
        {renderSectionHeader('Cuenta')}
        <View style={styles.sectionCard}>
          {renderRow({
            icon: <UserPen size={20} color={colors.primary[500]} />,
            label: 'Editar Perfil',
            onPress: () => navigation.navigate('EditProfile'),
          })}
        </View>

        {/* Preferences Section */}
        {renderSectionHeader('Preferencias')}
        <View style={styles.sectionCard}>
          {renderRow({
            icon: notificationsEnabled
              ? <Bell size={20} color={colors.primary[500]} />
              : <BellOff size={20} color={colors.slate[400]} />,
            label: 'Notificaciones',
            showChevron: false,
            rightElement: (
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: colors.slate[200], true: colors.primary[200] }}
                thumbColor={notificationsEnabled ? colors.primary[500] : colors.slate[300]}
              />
            ),
          })}
        </View>

        {/* Info Section */}
        {renderSectionHeader('Informacion')}
        <View style={styles.sectionCard}>
          {renderRow({
            icon: <Info size={20} color={colors.slate[500]} />,
            label: 'Version 1.0.0',
            showChevron: false,
          })}
          <View style={styles.rowDivider} />
          {renderRow({
            icon: <FileText size={20} color={colors.slate[500]} />,
            label: 'Terminos y Condiciones',
            onPress: () => Linking.openURL('https://lactamap.app/terms'),
          })}
          <View style={styles.rowDivider} />
          {renderRow({
            icon: <Shield size={20} color={colors.slate[500]} />,
            label: 'Politica de Privacidad',
            onPress: () => Linking.openURL('https://lactamap.app/privacy'),
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  sectionHeader: {
    ...typography.captionBold,
    color: colors.slate[400],
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.slate[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...typography.body,
    color: colors.slate[800],
    flex: 1,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.slate[100],
    marginLeft: spacing.lg + 36 + spacing.md,
  },
});
