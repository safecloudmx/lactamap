import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput,
} from 'react-native';
import { confirmAlert, infoAlert } from '../services/crossPlatformAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, DrawerActions } from '@react-navigation/native';
import {
  Menu, Edit3, Award, TrendingUp, FolderHeart,
  Trophy, ChevronRight, MapPin, MessageSquare,
  Plus, Pencil, Trash2, Check, X, Baby as BabyIcon,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getUserProfile } from '../services/api';
import { BADGES } from '../constants';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { AvatarInitials } from '../components/ui';
import { Baby } from '../types';
import * as nursingStorage from '../services/nursingStorage';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [profileData, setProfileData] = useState(user);

  // Baby management state
  const [babies, setBabies] = useState<Baby[]>([]);
  const [showBabyInput, setShowBabyInput] = useState(false);
  const [babyName, setBabyName] = useState('');
  const [editingBaby, setEditingBaby] = useState<Baby | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user?.isGuest) return;
      (async () => {
        try {
          const data = await getUserProfile();
          setProfileData(data);
        } catch (_) {}
      })();
    }, [user])
  );

  // Load babies on focus
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const list = await nursingStorage.getBabies();
        setBabies(list);
      })();
    }, [])
  );

  const displayUser = profileData || user;
  const userName = displayUser?.name || displayUser?.email?.split('@')[0] || 'Usuario';
  const level = displayUser?.level || Math.floor(Math.sqrt((displayUser?.points || 0) / 100)) + 1;

  const stats = [
    { icon: TrendingUp, label: 'Puntos', value: displayUser?.points || 0, color: colors.primary[500] },
    { icon: MapPin, label: 'Aportes', value: displayUser?.stats?.roomsAdded || 0, color: colors.success },
    { icon: MessageSquare, label: 'Resenas', value: displayUser?.stats?.reviewsWritten || 0, color: colors.info },
  ];

  const quickActions = [
    { icon: FolderHeart, label: 'Mis Aportes', route: 'MyContributions' },
  ];

  // === Baby CRUD handlers ===
  const handleAddBaby = async () => {
    const name = babyName.trim();
    if (!name) return;
    if (name.length < 2) {
      infoAlert('Error', 'El nombre debe tener al menos 2 caracteres');
      return;
    }
    const baby: Baby = {
      id: Date.now().toString(),
      name,
      createdAt: new Date().toISOString(),
    };
    await nursingStorage.saveBaby(baby);
    await nursingStorage.setActiveBabyId(baby.id);
    setBabies((prev) => [...prev, baby]);
    setBabyName('');
    setShowBabyInput(false);
  };

  const handleEditBaby = async () => {
    if (!editingBaby) return;
    const name = babyName.trim();
    if (!name) return;
    if (name.length < 2) {
      infoAlert('Error', 'El nombre debe tener al menos 2 caracteres');
      return;
    }
    await nursingStorage.updateBaby(editingBaby.id, { name });
    setBabies((prev) =>
      prev.map((b) => (b.id === editingBaby.id ? { ...b, name } : b))
    );
    setBabyName('');
    setEditingBaby(null);
  };

  const handleDeleteBaby = async (baby: Baby) => {
    const count = await nursingStorage.getSessionsCountByBabyId(baby.id);
    const warning = count > 0
      ? `Se eliminaran tambien ${count} registro${count > 1 ? 's' : ''} de tomas asociado${count > 1 ? 's' : ''} a "${baby.name}". Esta accion no se puede deshacer.`
      : `¿Eliminar a "${baby.name}" de la lista?`;

    confirmAlert(
      'Eliminar bebe',
      warning,
      async () => {
        if (count > 0) {
          await nursingStorage.deleteSessionsByBabyId(baby.id);
        }
        await nursingStorage.deleteBaby(baby.id);
        const activeBabyId = await nursingStorage.getActiveBabyId();
        if (activeBabyId === baby.id) {
          await nursingStorage.setActiveBabyId(null);
        }
        setBabies((prev) => prev.filter((b) => b.id !== baby.id));
      }
    );
  };

  const startEditBaby = (baby: Baby) => {
    setEditingBaby(baby);
    setBabyName(baby.name);
    setShowBabyInput(false);
  };

  const handleCancelBabyInput = () => {
    setShowBabyInput(false);
    setEditingBaby(null);
    setBabyName('');
  };

  const isEditingBaby = editingBaby !== null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.headerBg, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Menu size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('EditProfile')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Edit3 size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileSection}>
          <AvatarInitials name={userName} size="xl" color={colors.white} />
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userEmail}>{displayUser?.email}</Text>
          <View style={styles.levelBadge}>
            <Award size={14} color={colors.warning} />
            <Text style={styles.levelText}>Nivel {level}</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {stats.map((s, i) => (
          <View key={i} style={styles.statCard}>
            <s.icon size={20} color={s.color} />
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Mis Bebes Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleRow}>
            <BabyIcon size={20} color={colors.primary[500]} />
            <Text style={styles.sectionTitle}>Mis Bebes</Text>
          </View>
          <TouchableOpacity
            style={styles.addBabyBtn}
            onPress={() => { setShowBabyInput(true); setEditingBaby(null); setBabyName(''); }}
            activeOpacity={0.7}
          >
            <Plus size={16} color={colors.white} />
            <Text style={styles.addBabyBtnText}>Agregar</Text>
          </TouchableOpacity>
        </View>

        {/* Input for Add / Edit */}
        {(showBabyInput || isEditingBaby) && (
          <View style={styles.babyInputRow}>
            {isEditingBaby && (
              <Pencil size={14} color={colors.primary[500]} style={{ marginRight: 4 }} />
            )}
            <TextInput
              style={styles.babyInput}
              placeholder={isEditingBaby ? 'Nuevo nombre' : 'Nombre del bebe'}
              placeholderTextColor={colors.slate[400]}
              value={babyName}
              onChangeText={setBabyName}
              autoFocus
              maxLength={40}
              onSubmitEditing={isEditingBaby ? handleEditBaby : handleAddBaby}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.babyConfirmBtn}
              onPress={isEditingBaby ? handleEditBaby : handleAddBaby}
            >
              <Check size={18} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.babyCancelBtn} onPress={handleCancelBabyInput}>
              <X size={18} color={colors.slate[600]} />
            </TouchableOpacity>
          </View>
        )}

        {/* Baby List */}
        {babies.length === 0 && !showBabyInput ? (
          <View style={styles.emptyBabiesCard}>
            <BabyIcon size={32} color={colors.slate[300]} />
            <Text style={styles.emptyBabiesText}>
              No tienes bebes registrados.{'\n'}Agrega uno para personalizar tus sesiones.
            </Text>
          </View>
        ) : (
          babies.map((baby) => (
            <View key={baby.id} style={styles.babyCard}>
              <View style={styles.babyCardLeft}>
                <View style={styles.babyAvatar}>
                  <Text style={styles.babyAvatarText}>
                    {baby.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.babyCardInfo}>
                  <Text style={styles.babyCardName}>{baby.name}</Text>
                  <Text style={styles.babyCardDate}>
                    Registrado {new Date(baby.createdAt).toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
              <View style={styles.babyCardActions}>
                <TouchableOpacity
                  onPress={() => startEditBaby(baby)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.babyActionBtn}
                >
                  <Pencil size={16} color={colors.primary[500]} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteBaby(baby)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.babyActionBtn}
                >
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Badges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Insignias</Text>
        <View style={styles.badgesGrid}>
          {BADGES.map((badge) => {
            const earned = (displayUser?.points || 0) >= badge.threshold;
            return (
              <View key={badge.id} style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
                <Text style={styles.badgeIcon}>{badge.icon}</Text>
                <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>
                  {badge.name}
                </Text>
                {!earned && (
                  <Text style={styles.badgeProgress}>
                    {displayUser?.points || 0}/{badge.threshold}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acciones rapidas</Text>
        {quickActions.map((action, i) => (
          <TouchableOpacity
            key={i}
            style={styles.actionRow}
            onPress={() => navigation.navigate(action.route)}
            activeOpacity={0.7}
          >
            <action.icon size={20} color={colors.slate[600]} />
            <Text style={styles.actionLabel}>{action.label}</Text>
            <ChevronRight size={18} color={colors.slate[400]} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  headerBg: {
    backgroundColor: colors.primary[500],
    paddingBottom: spacing.xxxl + spacing.xl,
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.white,
  },
  profileSection: {
    alignItems: 'center',
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
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    marginTop: spacing.md,
  },
  levelText: {
    ...typography.captionBold,
    color: colors.white,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: -spacing.xxxl,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.md,
  },
  statValue: {
    ...typography.h3,
  },
  statLabel: {
    ...typography.caption,
    color: colors.slate[500],
  },
  section: {
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.slate[800],
    marginBottom: spacing.md,
  },
  addBabyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  addBabyBtnText: {
    ...typography.captionBold,
    color: colors.white,
  },
  babyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  babyInput: {
    flex: 1,
    ...typography.small,
    color: colors.slate[800],
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  babyConfirmBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  babyCancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBabiesCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.sm,
  },
  emptyBabiesText: {
    ...typography.small,
    color: colors.slate[500],
    textAlign: 'center',
    lineHeight: 22,
  },
  babyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  babyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  babyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  babyAvatarText: {
    ...typography.bodyBold,
    color: colors.primary[600],
  },
  babyCardInfo: {
    gap: 2,
    flex: 1,
  },
  babyCardName: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  babyCardDate: {
    ...typography.caption,
    color: colors.slate[400],
  },
  babyCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  babyActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.slate[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeCard: {
    width: '47%',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.sm,
  },
  badgeCardLocked: {
    opacity: 0.5,
  },
  badgeIcon: {
    fontSize: 28,
  },
  badgeName: {
    ...typography.captionBold,
    color: colors.slate[800],
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: colors.slate[400],
  },
  badgeProgress: {
    ...typography.caption,
    color: colors.slate[400],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radii.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  actionLabel: {
    ...typography.body,
    color: colors.slate[700],
    flex: 1,
  },
});
