import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Image, Modal, ActivityIndicator, Platform,
} from 'react-native';
import RefreshableScroll from '../components/ui/RefreshableScroll';
import { confirmAlert, infoAlert } from '../services/crossPlatformAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, DrawerActions } from '@react-navigation/native';
import {
  Menu, Edit3, Award, TrendingUp, FolderHeart,
  ChevronRight, MapPin, MessageSquare,
  Plus, Pencil, Check, X, Baby as BabyIcon,
  Users, Info, Link2Off, Clock,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import {
  getUserProfile,
  getPartnershipStatus, sendPartnerInvite, cancelPartnerInvite, dissolvePartnership,
} from '../services/api';
import { BADGES } from '../constants';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { AvatarInitials } from '../components/ui';
import { Baby, PartnershipStatus } from '../types';
import * as nursingStorage from '../services/nursingStorage';
import LoginPromptModal from '../components/LoginPromptModal';

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
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Partnership state
  const [partnerStatus, setPartnerStatus] = useState<PartnershipStatus | null>(null);
  const [partnershipLoading, setPartnershipLoading] = useState(false);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.isGuest) {
      try {
        const data = await getUserProfile();
        setProfileData(data);
      } catch (_) {}
      try {
        setPartnershipLoading(true);
        const status = await getPartnershipStatus();
        setPartnerStatus(status);
      } catch (_) {
      } finally {
        setPartnershipLoading(false);
      }
    }
    const list = await nursingStorage.getBabies();
    setBabies(list);
  }, [user]);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
  );

  const displayUser = profileData || user;
  const userName = displayUser?.name || displayUser?.email?.split('@')[0] || 'Usuario';
  const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin',
    ELITE: 'Elite',
    DISTINGUISHED: 'Distinguido',
    CONTRIBUTOR: 'Contribuidor',
    VISITOR: 'Visitante',
  };
  const roleLabel = ROLE_LABELS[displayUser?.role ?? ''] || displayUser?.role || 'Visitante';

  const stats = [
    { icon: TrendingUp, label: 'Puntos', value: displayUser?.points || 0, color: colors.primary[500] },
    { icon: MapPin, label: 'Aportes', value: displayUser?.stats?.roomsAdded || 0, color: colors.success },
    { icon: MessageSquare, label: 'Reseñas', value: displayUser?.stats?.reviewsWritten || 0, color: colors.info },
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
    const localBaby: Baby = {
      id: Date.now().toString(),
      name,
      createdAt: new Date().toISOString(),
    };
    // saveBaby returns the persisted baby (server ID when authenticated, local when guest)
    const savedBaby = await nursingStorage.saveBaby(localBaby);
    await nursingStorage.setActiveBabyId(savedBaby.id);
    setBabies((prev) => [...prev, savedBaby]);
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
      ? `Se eliminarán también ${count} registro${count > 1 ? 's' : ''} de tomas asociado${count > 1 ? 's' : ''} a "${baby.name}". Esta acción no se puede deshacer.`
      : `¿Eliminar a "${baby.name}" de la lista?`;

    confirmAlert(
      'Eliminar bebé',
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

  // === Partnership handlers ===
  const handleSendInvite = async () => {
    const email = partnerEmail.trim().toLowerCase();
    if (!email) return;
    setSendingInvite(true);
    try {
      await sendPartnerInvite(email);
      setPartnerEmail('');
      infoAlert('Invitación enviada', `Se envió un correo a ${email} para vincular las cuentas.`);
      const status = await getPartnershipStatus();
      setPartnerStatus(status);
    } catch (err: any) {
      infoAlert('Error', err?.response?.data?.error || 'No se pudo enviar la invitación.');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCancelInvite = () => {
    confirmAlert(
      'Cancelar invitación',
      '¿Quieres cancelar la invitación pendiente?',
      async () => {
        try {
          await cancelPartnerInvite();
          const status = await getPartnershipStatus();
          setPartnerStatus(status);
        } catch (err: any) {
          infoAlert('Error', err?.response?.data?.error || 'No se pudo cancelar.');
        }
      }
    );
  };

  const handleDissolve = () => {
    confirmAlert(
      'Desvincular cuenta',
      `¿Seguro que quieres desvincular tu cuenta de ${partnerStatus?.partnership?.partner?.name || partnerStatus?.partnership?.partner?.email}? Cada usuario conservará solo sus propios bebés y registros.`,
      async () => {
        try {
          await dissolvePartnership();
          const status = await getPartnershipStatus();
          setPartnerStatus(status);
          // Reload babies — shared babies will disappear
          const list = await nursingStorage.getBabies();
          setBabies(list);
        } catch (err: any) {
          infoAlert('Error', err?.response?.data?.error || 'No se pudo desvincular.');
        }
      }
    );
  };

  return (
    <RefreshableScroll
      onRefresh={loadData}
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
          <AvatarInitials name={userName} size="xl" color={colors.white} imageUrl={displayUser?.avatarUrl} />
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userEmail}>{displayUser?.email}</Text>
          <View style={styles.levelBadge}>
            <Award size={14} color={colors.warning} />
            <Text style={styles.levelText}>{roleLabel}</Text>
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
            onPress={() => {
              if (user?.isGuest) {
                setShowLoginModal(true);
              } else {
                setShowBabyInput(true);
                setEditingBaby(null);
                setBabyName('');
              }
            }}
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
              placeholder={isEditingBaby ? 'Nuevo nombre' : 'Nombre del bebé'}
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
              No tienes bebés registrados.{'\n'}Agrega uno para personalizar tus sesiones.
            </Text>
          </View>
        ) : (
          babies.map((baby) => (
            <TouchableOpacity
              key={baby.id}
              style={styles.babyCard}
              onPress={() => navigation.navigate('BabyDetail', { babyId: baby.id })}
              activeOpacity={0.7}
            >
              <View style={styles.babyCardLeft}>
                {baby.avatarUrl ? (
                  <Image source={{ uri: baby.avatarUrl }} style={styles.babyAvatarImg} />
                ) : (
                  <View style={styles.babyAvatar}>
                    <Text style={styles.babyAvatarText}>
                      {baby.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.babyCardInfo}>
                  <Text style={styles.babyCardName}>{baby.name}</Text>
                  <Text style={styles.babyCardDate}>
                    {baby.birthDate
                      ? `Nacido ${new Date(baby.birthDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`
                      : `Registrado ${new Date(baby.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`
                    }
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.slate[400]} />
            </TouchableOpacity>
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

      {/* Partner Linking */}
      {!user?.isGuest && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Users size={20} color={colors.primary[500]} />
              <Text style={styles.sectionTitle}>Vinculación de cuenta</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowInfoModal(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Info size={18} color={colors.slate[400]} />
            </TouchableOpacity>
          </View>

          {partnershipLoading ? (
            <ActivityIndicator color={colors.primary[500]} style={{ marginTop: spacing.md }} />
          ) : partnerStatus?.partnership ? (
            /* Active partnership */
            <View style={styles.partnerCard}>
              <AvatarInitials
                name={partnerStatus.partnership.partner.name || partnerStatus.partnership.partner.email}
                size="md"
                imageUrl={partnerStatus.partnership.partner.avatarUrl}
              />
              <View style={styles.partnerInfo}>
                <Text style={styles.partnerName}>
                  {partnerStatus.partnership.partner.name || partnerStatus.partnership.partner.email}
                </Text>
                <Text style={styles.partnerEmail}>{partnerStatus.partnership.partner.email}</Text>
                <Text style={styles.partnerSince}>
                  Vinculados desde {new Date(partnerStatus.partnership.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <TouchableOpacity onPress={handleDissolve} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Link2Off size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          ) : partnerStatus?.pendingInvite ? (
            /* Pending invite sent */
            <View style={styles.pendingCard}>
              <Clock size={18} color={colors.warning} />
              <View style={styles.pendingInfo}>
                <Text style={styles.pendingTitle}>Invitación pendiente</Text>
                <Text style={styles.pendingEmail}>{partnerStatus.pendingInvite.recipientEmail}</Text>
                <Text style={styles.pendingExpiry}>
                  Expira {new Date(partnerStatus.pendingInvite.expiresAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <TouchableOpacity onPress={handleCancelInvite}>
                <X size={20} color={colors.slate[400]} />
              </TouchableOpacity>
            </View>
          ) : (
            /* No partnership — invite form */
            <View style={styles.inviteForm}>
              <Text style={styles.inviteHint}>
                Vincula tu cuenta con la de tu pareja para compartir los registros de sus bebés.
              </Text>
              <View style={styles.inviteRow}>
                {Platform.OS === 'web' ? (
                  <input
                    type="email"
                    placeholder="Correo de tu pareja"
                    value={partnerEmail}
                    onChange={(e: any) => setPartnerEmail(e.target.value)}
                    onKeyDown={(e: any) => { if (e.key === 'Enter') handleSendInvite(); }}
                    style={{
                      flex: 1, border: '1px solid #e2e8f0', borderRadius: 8,
                      padding: '10px 14px', fontSize: 14, outline: 'none',
                      fontFamily: 'inherit', color: '#1e293b', background: '#fff',
                    } as any}
                  />
                ) : (
                  <TextInput
                    style={styles.inviteInput}
                    placeholder="Correo de tu pareja"
                    placeholderTextColor={colors.slate[400]}
                    value={partnerEmail}
                    onChangeText={setPartnerEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="send"
                    onSubmitEditing={handleSendInvite}
                  />
                )}
                <TouchableOpacity
                  style={[styles.inviteBtn, (!partnerEmail.trim() || sendingInvite) && styles.inviteBtnDisabled]}
                  onPress={handleSendInvite}
                  disabled={!partnerEmail.trim() || sendingInvite}
                >
                  {sendingInvite
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={styles.inviteBtnText}>Invitar</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Info tooltip modal */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowInfoModal(false)}
        >
          <View style={styles.infoModal}>
            <View style={styles.infoModalHeader}>
              <Users size={22} color={colors.primary[500]} />
              <Text style={styles.infoModalTitle}>Vinculación de cuentas</Text>
            </View>
            <Text style={styles.infoModalBody}>
              Esta función te permite sincronizar los datos de tus bebés con la cuenta de tu pareja, para que ambos puedan registrar y consultar las sesiones de lactancia, extracción, sueño, pañales y crecimiento.
            </Text>
            <Text style={styles.infoModalSubtitle}>¿Qué implica vincular una cuenta?</Text>
            {[
              'Ambos usuarios podrán ver y crear registros para todos los bebés compartidos.',
              'Si fusionas dos bebés, sus registros se unirán de forma permanente e irreversible.',
              'Al desvincular las cuentas, cada usuario conservará solo sus propios bebés y registros.',
              'Tu perfil, correo y contraseña permanecen completamente privados.',
              'Solo puedes tener una cuenta vinculada a la vez.',
            ].map((item, i) => (
              <View key={i} style={styles.infoModalItem}>
                <Text style={styles.infoModalBullet}>•</Text>
                <Text style={styles.infoModalItemText}>{item}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.infoModalClose}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.infoModalCloseText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <LoginPromptModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Inicia sesión para registrar a tu bebé"
        message="Crea una cuenta para guardar el perfil de tu bebé y sincronizar tus sesiones de lactancia de forma segura."
      />
    </RefreshableScroll>
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
  babyAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  // Partner linking
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[400],
  },
  partnerInfo: { flex: 1, gap: 2 },
  partnerName: { ...typography.bodyBold, color: colors.slate[800] },
  partnerEmail: { ...typography.caption, color: colors.slate[500] },
  partnerSince: { ...typography.caption, color: colors.primary[500], marginTop: 2 },

  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  pendingInfo: { flex: 1, gap: 2 },
  pendingTitle: { ...typography.smallBold, color: colors.slate[700] },
  pendingEmail: { ...typography.caption, color: colors.slate[600] },
  pendingExpiry: { ...typography.caption, color: colors.warning },

  inviteForm: { gap: spacing.md },
  inviteHint: { ...typography.caption, color: colors.slate[500], lineHeight: 18 },
  inviteRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  inviteInput: {
    flex: 1,
    ...typography.small,
    color: colors.slate[800],
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inviteBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  inviteBtnDisabled: { opacity: 0.5 },
  inviteBtnText: { ...typography.smallBold, color: colors.white },

  // Info modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  infoModal: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
    ...shadows.lg,
  },
  infoModalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoModalTitle: { ...typography.h4, color: colors.slate[800] },
  infoModalBody: { ...typography.small, color: colors.slate[600], lineHeight: 20 },
  infoModalSubtitle: { ...typography.smallBold, color: colors.slate[700], marginTop: spacing.xs },
  infoModalItem: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  infoModalBullet: { ...typography.smallBold, color: colors.primary[500], marginTop: 1 },
  infoModalItemText: { ...typography.small, color: colors.slate[600], flex: 1, lineHeight: 20 },
  infoModalClose: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  infoModalCloseText: { ...typography.smallBold, color: colors.white },
});
