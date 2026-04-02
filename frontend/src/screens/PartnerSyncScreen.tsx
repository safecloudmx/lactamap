import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CheckCircle2, XCircle, Users, Baby as BabyIcon, ChevronDown, ArrowRight } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getPartnerPreview, confirmPartnership } from '../services/api';
import { PartnerPreview, BabyMerge } from '../types';
import { AppHeader, AvatarInitials } from '../components/ui';
import { colors, spacing, typography, radii, shadows } from '../theme';

type BabyItem = PartnerPreview['senderBabies'][number];

export default function PartnerSyncScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const token: string | undefined = route.params?.token;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PartnerPreview | null>(null);
  const [confirming, setConfirming] = useState(false);

  // For case 4.2: maps senderBabyId → recipientBabyId (or null = keep separate)
  const [mergeMap, setMergeMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!token) {
      setError('Token de invitación no encontrado.');
      setLoading(false);
      return;
    }
    if (!user || user.isGuest) {
      setError('Debes iniciar sesión para ver esta invitación.');
      setLoading(false);
      return;
    }
    getPartnerPreview(token)
      .then((data: PartnerPreview) => {
        setPreview(data);
        // Init merge map: each sender baby defaults to "no merge"
        const init: Record<string, string | null> = {};
        data.senderBabies.forEach((b) => { init[b.id] = null; });
        setMergeMap(init);
      })
      .catch((err: any) => {
        setError(err?.response?.data?.error || 'No se pudo cargar la invitación.');
      })
      .finally(() => setLoading(false));
  }, [token, user]);

  const handleAction = async (action: 'accept' | 'reject') => {
    if (!token || !preview) return;

    if (action === 'reject') {
      Alert.alert(
        'Rechazar invitación',
        `¿Seguro que quieres rechazar la invitación de ${preview.invite.sender.name || preview.invite.sender.email}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Rechazar',
            style: 'destructive',
            onPress: () => doConfirm('reject', []),
          },
        ]
      );
      return;
    }

    // Build merges only for explicitly paired babies
    const babyMerges: BabyMerge[] = Object.entries(mergeMap)
      .filter(([, recipientId]) => recipientId !== null)
      .map(([senderBabyId, recipientBabyId]) => ({
        mergeBabyId: senderBabyId,
        keepBabyId: recipientBabyId!,
      }));

    doConfirm('accept', babyMerges);
  };

  const doConfirm = async (action: 'accept' | 'reject', babyMerges: BabyMerge[]) => {
    setConfirming(true);
    try {
      await confirmPartnership({ token: token!, action, babyMerges });
      if (action === 'accept') {
        Alert.alert(
          '¡Cuentas vinculadas!',
          `Ahora compartes los registros de tus bebés con ${preview?.invite.sender.name || preview?.invite.sender.email}.`,
          [{ text: 'Continuar', onPress: () => navigation.navigate('Main') }]
        );
      } else {
        navigation.navigate('Main');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'No se pudo procesar la invitación.');
    } finally {
      setConfirming(false);
    }
  };

  const toggleMerge = (senderBabyId: string, recipientBabyId: string | null) => {
    setMergeMap((prev) => {
      const next = { ...prev };
      // If this recipientBabyId is already selected for another sender baby, clear it
      if (recipientBabyId !== null) {
        Object.keys(next).forEach((k) => {
          if (k !== senderBabyId && next[k] === recipientBabyId) {
            next[k] = null;
          }
        });
      }
      next[senderBabyId] = recipientBabyId;
      return next;
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Cargando invitación...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <XCircle size={48} color={colors.error} />
        <Text style={styles.errorTitle}>Invitación no válida</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.primaryBtnText}>Ir al inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!preview) return null;

  const { invite, senderBabies, recipientBabies } = preview;
  const hasSenderBabies = senderBabies.length > 0;
  const hasRecipientBabies = recipientBabies.length > 0;

  // Determine case
  const isCase43 = !hasSenderBabies && !hasRecipientBabies;
  const isCase41 = hasSenderBabies !== hasRecipientBabies; // exactly one side has babies
  const isCase42 = hasSenderBabies && hasRecipientBabies;

  const senderName = invite.sender.name || invite.sender.email;

  return (
    <View style={styles.container}>
      <AppHeader title="Invitación de vínculo" onBack={() => navigation.navigate('Main')} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Sender card */}
        <View style={styles.senderCard}>
          <AvatarInitials
            name={senderName}
            size="lg"
            imageUrl={invite.sender.avatarUrl}
          />
          <View style={styles.senderInfo}>
            <Text style={styles.senderName}>{senderName}</Text>
            <Text style={styles.senderEmail}>{invite.sender.email}</Text>
          </View>
          <Users size={24} color={colors.primary[500]} />
        </View>

        <Text style={styles.inviteDesc}>
          <Text style={styles.bold}>{senderName}</Text> quiere vincular su cuenta contigo para compartir los registros de sus bebés.
        </Text>

        {/* Case 4.3 — neither has babies */}
        {isCase43 && (
          <View style={styles.infoBox}>
            <BabyIcon size={20} color={colors.slate[500]} />
            <Text style={styles.infoText}>
              Ninguno de los dos tiene bebés registrados aún. Al vincularse, cualquier bebé que registren en el futuro será visible para ambos.
            </Text>
          </View>
        )}

        {/* Case 4.1 — only sender has babies */}
        {isCase41 && hasSenderBabies && (
          <View>
            <Text style={styles.sectionLabel}>Bebés que se compartirán contigo</Text>
            {senderBabies.map((baby) => (
              <BabyRow key={baby.id} baby={baby} />
            ))}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Estos bebés y todos sus registros quedarán accesibles en tu cuenta.
              </Text>
            </View>
          </View>
        )}

        {/* Case 4.1 — only recipient has babies */}
        {isCase41 && hasRecipientBabies && (
          <View>
            <Text style={styles.sectionLabel}>Tus bebés que se compartirán</Text>
            {recipientBabies.map((baby) => (
              <BabyRow key={baby.id} baby={baby} />
            ))}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Tus bebés y todos sus registros quedarán accesibles en la cuenta de {senderName}.
              </Text>
            </View>
          </View>
        )}

        {/* Case 4.2 — both have babies */}
        {isCase42 && (
          <View>
            <Text style={styles.sectionLabel}>Sincronización de bebés</Text>
            <Text style={styles.mergeHint}>
              Indica si algún bebé de {senderName} es el mismo que uno de los tuyos para unir sus registros. Si son bebés diferentes, déjalo en "Mantener separado".
            </Text>
            {senderBabies.map((senderBaby) => (
              <MergeSelector
                key={senderBaby.id}
                senderBaby={senderBaby}
                recipientBabies={recipientBabies}
                selected={mergeMap[senderBaby.id] ?? null}
                onSelect={(recipientId) => toggleMerge(senderBaby.id, recipientId)}
              />
            ))}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Los bebés que fusiones unirán permanentemente todos sus registros. Esta acción no se puede deshacer.
              </Text>
            </View>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, confirming && styles.btnDisabled]}
            onPress={() => handleAction('accept')}
            disabled={confirming}
          >
            {confirming
              ? <ActivityIndicator size="small" color={colors.white} />
              : (
                <>
                  <CheckCircle2 size={18} color={colors.white} />
                  <Text style={styles.primaryBtnText}>Aceptar y vincular</Text>
                </>
              )
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ghostBtn, confirming && styles.btnDisabled]}
            onPress={() => handleAction('reject')}
            disabled={confirming}
          >
            <XCircle size={18} color={colors.error} />
            <Text style={styles.ghostBtnText}>Rechazar invitación</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BabyRow({ baby }: { baby: BabyItem }) {
  return (
    <View style={styles.babyRow}>
      <View style={styles.babyAvatar}>
        <Text style={styles.babyAvatarText}>{baby.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.babyName}>{baby.name}</Text>
      {baby.birthDate && (
        <Text style={styles.babyDate}>
          {new Date(baby.birthDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Text>
      )}
    </View>
  );
}

function MergeSelector({
  senderBaby,
  recipientBabies,
  selected,
  onSelect,
}: {
  senderBaby: BabyItem;
  recipientBabies: BabyItem[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedBaby = recipientBabies.find((b) => b.id === selected);

  return (
    <View style={styles.mergeCard}>
      <View style={styles.mergeCardHeader}>
        <View style={styles.babyAvatar}>
          <Text style={styles.babyAvatarText}>{senderBaby.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.babyName}>{senderBaby.name}</Text>
        {selected && <ArrowRight size={14} color={colors.primary[500]} />}
      </View>

      <TouchableOpacity
        style={styles.mergeSelector}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={[styles.mergeSelectorText, !selected && styles.mergeSelectorPlaceholder]}>
          {selected ? `Fusionar con: ${selectedBaby?.name}` : 'Mantener separado'}
        </Text>
        <ChevronDown size={16} color={colors.slate[400]} />
      </TouchableOpacity>

      {open && (
        <View style={styles.mergeOptions}>
          <TouchableOpacity
            style={styles.mergeOption}
            onPress={() => { onSelect(null); setOpen(false); }}
          >
            <Text style={styles.mergeOptionText}>Mantener separado</Text>
            {selected === null && <Text style={styles.mergeOptionCheck}>✓</Text>}
          </TouchableOpacity>
          {recipientBabies.map((rb) => (
            <TouchableOpacity
              key={rb.id}
              style={styles.mergeOption}
              onPress={() => { onSelect(rb.id); setOpen(false); }}
            >
              <Text style={styles.mergeOptionText}>Fusionar con: {rb.name}</Text>
              {selected === rb.id && <Text style={styles.mergeOptionCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate[50] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  content: { padding: spacing.lg, paddingBottom: 60, gap: spacing.xl },

  loadingText: { ...typography.body, color: colors.slate[500] },
  errorTitle: { ...typography.h3, color: colors.slate[800], textAlign: 'center' },
  errorText: { ...typography.body, color: colors.slate[500], textAlign: 'center' },

  senderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.md,
  },
  senderInfo: { flex: 1 },
  senderName: { ...typography.bodyBold, color: colors.slate[800] },
  senderEmail: { ...typography.caption, color: colors.slate[500] },

  inviteDesc: { ...typography.body, color: colors.slate[600], lineHeight: 22 },
  bold: { fontWeight: '700', color: colors.slate[800] },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radii.md,
    padding: spacing.md,
  },
  infoText: { ...typography.small, color: colors.primary[700], flex: 1, lineHeight: 20 },

  sectionLabel: { ...typography.smallBold, color: colors.slate[600], marginBottom: spacing.sm },

  babyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  babyAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary[100],
    alignItems: 'center', justifyContent: 'center',
  },
  babyAvatarText: { ...typography.smallBold, color: colors.primary[600] },
  babyName: { ...typography.bodyBold, color: colors.slate[800], flex: 1 },
  babyDate: { ...typography.caption, color: colors.slate[400] },

  mergeHint: { ...typography.small, color: colors.slate[500], marginBottom: spacing.md, lineHeight: 20 },

  mergeCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
    gap: spacing.sm,
  },
  mergeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mergeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.slate[50],
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.slate[200],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mergeSelectorText: { ...typography.small, color: colors.slate[800] },
  mergeSelectorPlaceholder: { color: colors.slate[400] },
  mergeOptions: {
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.slate[200],
    overflow: 'hidden',
    ...shadows.sm,
  },
  mergeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  mergeOptionText: { ...typography.small, color: colors.slate[700] },
  mergeOptionCheck: { ...typography.smallBold, color: colors.primary[500] },

  actions: { gap: spacing.md, marginTop: spacing.sm },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    ...shadows.primary,
  },
  primaryBtnText: { ...typography.button, color: colors.white },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  ghostBtnText: { ...typography.button, color: colors.error },
  btnDisabled: { opacity: 0.6 },
});
