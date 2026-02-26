import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import {
  Home, Map, Compass, User, FolderHeart, Trophy,
  Settings, Info, LogOut, ChevronRight, MapPin,
  ToolCaseIcon,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { AvatarInitials } from '../components/ui';
import { colors, spacing, typography, radii, shadows } from '../theme';

interface MenuItem {
  icon: any;
  label: string;
  route?: string;
  tab?: string;
  danger?: boolean;
  onPress?: () => void;
}

export default function DrawerContent({ navigation }: DrawerContentComponentProps) {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const userName = user?.name || user?.email?.split('@')[0] || 'Usuario';

  const handleNavigate = (route?: string, tab?: string) => {
    if (tab) {
      navigation.navigate('HomeTabs', { screen: tab });
    } else if (route) {
      navigation.navigate(route);
    }
    navigation.closeDrawer();
  };

  const handleSignOut = async () => {
    navigation.closeDrawer();
    await signOut();
  };

  const mainItems: MenuItem[] = [
    { icon: Home, label: 'Inicio', tab: 'Inicio' },
    { icon: MapPin, label: 'Mapa', tab: 'Mapa' },
    { icon: Compass, label: 'Explorar', tab: 'Explorar' },
    { icon: User, label: 'Mi Perfil', tab: 'Perfil' },
    { icon: FolderHeart, label: 'Mis Aportes', route: 'MyContributions' },
    { icon: ToolCaseIcon, label: 'Recursos', route: 'Resources' },
  ];

  const secondaryItems: MenuItem[] = [
    { icon: Settings, label: 'Configuracion', route: 'Settings' },
    { icon: Info, label: 'Acerca de', route: 'About' },
  ];

  const renderItem = (item: MenuItem, index: number) => (
    <TouchableOpacity
      key={index}
      style={[styles.menuItem, item.danger && styles.menuItemDanger]}
      onPress={item.onPress || (() => handleNavigate(item.route, item.tab))}
      activeOpacity={0.7}
    >
      <item.icon
        size={22}
        color={item.danger ? colors.error : colors.slate[600]}
      />
      <Text style={[styles.menuLabel, item.danger && styles.menuLabelDanger]}>
        {item.label}
      </Text>
      <ChevronRight size={16} color={colors.slate[300]} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBg} />
        <AvatarInitials name={userName} size="xl" />
        <Text style={styles.userName}>{userName}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.points || 0}</Text>
            <Text style={styles.statLabel}>Puntos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.stats?.roomsAdded || 0}</Text>
            <Text style={styles.statLabel}>Aportes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.stats?.reviewsWritten || 0}</Text>
            <Text style={styles.statLabel}>Resenas</Text>
          </View>
        </View>
      </View>

      {/* Menu */}
      <ScrollView style={styles.menu} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          {mainItems.map(renderItem)}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          {secondaryItems.map(renderItem)}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          {renderItem({
            icon: LogOut,
            label: 'Cerrar Sesion',
            danger: true,
            onPress: handleSignOut,
          }, 99)}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Text style={styles.version}>LactaMap v0.0.3</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
    paddingTop: spacing.xxxl,
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary[500],
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
  },
  userName: {
    ...typography.h3,
    color: colors.white,
    marginTop: spacing.md,
  },
  userEmail: {
    ...typography.small,
    color: colors.primary[200],
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...typography.bodyBold,
    color: colors.white,
  },
  statLabel: {
    ...typography.caption,
    color: colors.primary[200],
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  menu: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    gap: spacing.md,
  },
  menuItemDanger: {},
  menuLabel: {
    ...typography.body,
    color: colors.slate[700],
    flex: 1,
  },
  menuLabelDanger: {
    color: colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate[100],
    marginHorizontal: spacing.xxl,
    marginVertical: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  version: {
    ...typography.caption,
    color: colors.slate[400],
  },
});
