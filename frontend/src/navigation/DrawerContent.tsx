import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import {
  Home, Map, Compass, User, FolderHeart, Trophy,
  Settings, Info, LogOut, ChevronRight, MapPin,
  ToolCaseIcon, ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { AvatarInitials } from '../components/ui';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { getSubmissions, getUserProfile } from '../services/api';

interface MenuItem {
  icon: any;
  label: string;
  route?: string;
  tab?: string;
  danger?: boolean;
  badge?: number;
  onPress?: () => void;
}

export default function DrawerContent({ navigation }: DrawerContentComponentProps) {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const userName = user?.name || user?.email?.split('@')[0] || 'Usuario';
  const [profileData, setProfileData] = useState<any>(null);

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

  const isAdminOrElite = user?.role === 'ADMIN' || user?.role === 'ELITE';
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    getUserProfile().then(setProfileData).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!isAdminOrElite) return;
    getSubmissions('PENDING')
      .then((data) => setPendingCount(data.length))
      .catch(() => {});
  }, [isAdminOrElite]);

  const mainItems: MenuItem[] = [
    { icon: Home, label: 'Inicio', tab: 'Inicio' },
    { icon: MapPin, label: 'Mapa', tab: 'Mapa' },
    { icon: Compass, label: 'Explorar', tab: 'Explorar' },
    { icon: User, label: 'Mi Perfil', tab: 'Perfil' },
    { icon: FolderHeart, label: 'Mis Aportes', route: 'MyContributions' },
    { icon: ToolCaseIcon, label: 'Recursos', route: 'Resources' },
    ...(isAdminOrElite ? [{ icon: ShieldCheck, label: 'Revisión de Aportes', route: 'AdminReview', badge: pendingCount }] : []),
  ];

  const secondaryItems: MenuItem[] = [
    { icon: Settings, label: 'Configuración', route: 'Settings' },
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
      {!!item.badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.badge > 99 ? '99+' : item.badge}</Text>
        </View>
      )}
      <ChevronRight size={16} color={colors.slate[300]} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBg} />
        <AvatarInitials name={userName} size="xl" imageUrl={profileData?.avatarUrl || (user as any)?.avatarUrl} />
        <Text style={styles.userName}>{userName}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profileData?.points ?? user?.points ?? 0}</Text>
            <Text style={styles.statLabel}>Puntos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profileData?.stats?.roomsAdded ?? 0}</Text>
            <Text style={styles.statLabel}>Aportes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profileData?.stats?.reviewsWritten ?? 0}</Text>
            <Text style={styles.statLabel}>Reseñas</Text>
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
        <Text style={styles.version}>LactaMap v0.08-260320</Text>
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
    marginTop: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  statValue: {
    ...typography.h3,
    color: colors.white,
  },
  statLabel: {
    ...typography.small,
    color: colors.primary[200],
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
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
  badge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
  },
});
