import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Droplets, Snowflake, Thermometer, CheckCircle,
  Sun, Moon, Clock, ImageIcon,
} from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { PumpingSession } from '../types';
import {
  getPumpingSessionByFolio, updatePumpingStatusByFolio,
  getPumpingSessionByPublicToken, updatePumpingStatusByPublicToken,
} from '../services/api';
import ExpirationBadge from '../components/ExpirationBadge';
import PumpingQRCode from '../components/PumpingQRCode';
import { useAuth } from '../context/AuthContext';

function getSideLabel(side: string): string {
  if (side === 'LEFT') return 'Izquierdo';
  if (side === 'RIGHT') return 'Derecho';
  return 'Ambos';
}

function getStorageLabel(status: string): string {
  if (status === 'FROZEN') return 'Congelado';
  if (status === 'REFRIGERATED') return 'Refrigerado';
  return 'Consumido';
}

function getStorageIcon(status: string) {
  if (status === 'FROZEN') return { Icon: Snowflake, color: '#3b82f6' };
  if (status === 'REFRIGERATED') return { Icon: Thermometer, color: '#06b6d4' };
  return { Icon: CheckCircle, color: '#22c55e' };
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()} - ${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// Allowed transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  FROZEN: ['REFRIGERATED', 'CONSUMED'],
  REFRIGERATED: ['CONSUMED'],
  CONSUMED: [],
};

const CONSUMED_LOCK_MS = 15 * 60 * 1000;

export default function PumpingFolioDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Determine mode: private (folio) or public (token)
  const folio: string | undefined = route.params?.folio;
  const publicToken: string | undefined = route.params?.token;
  const isPublicMode = !!publicToken && !folio;

  const [session, setSession] = useState<PumpingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [comment, setComment] = useState('');

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      if (isPublicMode && publicToken) {
        data = await getPumpingSessionByPublicToken(publicToken);
      } else if (folio) {
        data = await getPumpingSessionByFolio(folio);
      }
      if (data) setSession(data);
    } catch (err) {
      console.error('Error loading folio:', err);
    } finally {
      setLoading(false);
    }
  }, [folio, publicToken, isPublicMode]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const isOwner = !isPublicMode && user && session && user.id === session.userId;

  // In public mode, anyone can change status
  const canChangeStatus = isPublicMode || isOwner;

  // Check if CONSUMED is locked (15 min)
  const isConsumedLocked = useMemo(() => {
    if (!session || session.storageStatus !== 'CONSUMED') return false;
    if (!session.consumedAt) return false;
    const elapsed = Date.now() - new Date(session.consumedAt).getTime();
    return elapsed > CONSUMED_LOCK_MS;
  }, [session]);

  const availableTransitions = useMemo(() => {
    if (!session) return [];
    if (isConsumedLocked) return [];
    return VALID_TRANSITIONS[session.storageStatus || 'FROZEN'] || [];
  }, [session, isConsumedLocked]);

  const handleStatusChange = async (newStatus: string) => {
    if (!session) return;
    setUpdating(true);
    try {
      let updated;
      if (isPublicMode && publicToken) {
        updated = await updatePumpingStatusByPublicToken(publicToken, {
          storageStatus: newStatus,
          comment: comment.trim() || undefined,
        });
      } else if (session.folio) {
        updated = await updatePumpingStatusByFolio(session.folio, {
          storageStatus: newStatus,
          comment: comment.trim() || undefined,
        });
      }
      if (updated) {
        setSession(updated);
        setComment('');
        Alert.alert('Actualizado', `Estado cambiado a ${getStorageLabel(newStatus)}`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo actualizar');
    } finally {
      setUpdating(false);
    }
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('PumpingHistory');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {!isPublicMode && (
          <View style={styles.header}>
            <TouchableOpacity onPress={handleGoBack}>
              <ArrowLeft size={24} color={colors.slate[800]} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Detalle de Folio</Text>
            <View style={{ width: 24 }} />
          </View>
        )}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {!isPublicMode && (
          <View style={styles.header}>
            <TouchableOpacity onPress={handleGoBack}>
              <ArrowLeft size={24} color={colors.slate[800]} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Detalle de Folio</Text>
            <View style={{ width: 24 }} />
          </View>
        )}
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>No se encontró el registro.</Text>
        </View>
      </View>
    );
  }

  const storage = getStorageIcon(session.storageStatus || 'FROZEN');
  const StorageIcon = storage.Icon;

  return (
    <View style={[styles.container, { paddingTop: isPublicMode ? insets.top + spacing.lg : insets.top }]}>
      {/* Header — hidden in public mode */}
      {!isPublicMode && (
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack}>
            <ArrowLeft size={24} color={colors.slate[800]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle de Folio</Text>
          <View style={{ width: 24 }} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* QR Codes — hidden in public mode */}
        {!isPublicMode && session.folio && (
          <View style={styles.qrSection}>
            <PumpingQRCode folio={session.folio} publicToken={session.publicToken} size={130} />
          </View>
        )}

        {/* Public mode header */}
        {isPublicMode && (
          <View style={styles.publicHeader}>
            <Droplets size={32} color={colors.info} />
            <Text style={styles.publicTitle}>Registro de Extracción</Text>
            {session.folio && (
              <Text style={styles.publicFolio}>{session.folio}</Text>
            )}
          </View>
        )}

        {/* Info card */}
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Droplets size={18} color={colors.info} />
            <Text style={styles.infoLabel}>Lado</Text>
            <Text style={styles.infoValue}>{getSideLabel(session.side)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Clock size={18} color={colors.slate[400]} />
            <Text style={styles.infoLabel}>Fecha</Text>
            <Text style={styles.infoValue}>{formatDateTime(session.pumpedAt)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cantidad</Text>
            <Text style={[styles.infoValue, { fontWeight: '700', fontSize: 18 }]}>{session.amountMl} ml</Text>
          </View>
          {/* Baby name — only in private mode */}
          {!isPublicMode && session.baby && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bebé</Text>
                <Text style={[styles.infoValue, { color: colors.info }]}>{session.baby.name}</Text>
              </View>
            </>
          )}
          {session.classification && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                {session.classification === 'DAY' ? (
                  <Sun size={18} color="#f59e0b" />
                ) : (
                  <Moon size={18} color="#6366f1" />
                )}
                <Text style={styles.infoLabel}>Clasificación</Text>
                <Text style={styles.infoValue}>{session.classification === 'DAY' ? 'Día' : 'Noche'}</Text>
              </View>
            </>
          )}
          {/* Notes — only in private mode */}
          {!isPublicMode && session.notes && (
            <>
              <View style={styles.divider} />
              <Text style={styles.notesText}>{session.notes}</Text>
            </>
          )}
        </View>

        {/* Storage status card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Estado de Consumo</Text>
          <View style={[styles.statusBadge, { backgroundColor: storage.color + '15' }]}>
            <StorageIcon size={20} color={storage.color} />
            <Text style={[styles.statusBadgeText, { color: storage.color }]}>
              {getStorageLabel(session.storageStatus || 'FROZEN')}
            </Text>
          </View>

          {session.storageStatus !== 'CONSUMED' && session.expirationDate && (
            <View style={styles.expirationSection}>
              <Text style={styles.expirationLabel}>Expiración</Text>
              <ExpirationBadge
                expirationDate={session.expirationDate}
                storageStatus={session.storageStatus || 'FROZEN'}
              />
            </View>
          )}

          {/* Status change actions */}
          {canChangeStatus && availableTransitions.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.changeTitle}>Cambiar estado</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Comentario (opcional)"
                placeholderTextColor={colors.slate[300]}
                value={comment}
                onChangeText={setComment}
                maxLength={500}
              />
              <View style={styles.changeRow}>
                {availableTransitions.includes('REFRIGERATED') && (
                  <TouchableOpacity
                    style={[styles.changeBtn, { backgroundColor: '#06b6d4' }]}
                    onPress={() => handleStatusChange('REFRIGERATED')}
                    disabled={updating}
                  >
                    <Thermometer size={16} color={colors.white} />
                    <Text style={styles.changeBtnText}>Refrigerar</Text>
                  </TouchableOpacity>
                )}
                {availableTransitions.includes('CONSUMED') && (
                  <TouchableOpacity
                    style={[styles.changeBtn, { backgroundColor: '#22c55e' }]}
                    onPress={() => handleStatusChange('CONSUMED')}
                    disabled={updating}
                  >
                    <CheckCircle size={16} color={colors.white} />
                    <Text style={styles.changeBtnText}>Consumido</Text>
                  </TouchableOpacity>
                )}
              </View>
              {updating && <ActivityIndicator size="small" color={colors.info} style={{ marginTop: spacing.sm }} />}
            </>
          )}

          {isConsumedLocked && session.storageStatus === 'CONSUMED' && (
            <>
              <View style={styles.divider} />
              <Text style={styles.lockedHint}>
                El estado de consumo ya no puede modificarse (pasaron 15 min).
              </Text>
            </>
          )}
        </View>

        {/* Status history */}
        {session.statusHistory && session.statusHistory.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Historial de Estado</Text>
            {session.statusHistory.map((entry) => (
              <View key={entry.id} style={styles.historyEntry}>
                <View style={styles.historyDot} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyText}>
                    {entry.fromStatus ? `${getStorageLabel(entry.fromStatus)} → ` : ''}
                    {getStorageLabel(entry.toStatus)}
                  </Text>
                  <Text style={styles.historyDate}>{formatDateTime(entry.changedAt)}</Text>
                  {entry.comment && (
                    <Text style={styles.historyComment}>{entry.comment}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Photos — only in private mode */}
        {!isPublicMode && session.photos && session.photos.length > 0 && (
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <ImageIcon size={18} color={colors.slate[400]} />
              <Text style={styles.cardTitle}>Fotos ({session.photos.length})</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
              {session.photos.map((p) => (
                <Image key={p.id} source={{ uri: p.url }} style={styles.photoThumb} />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  headerTitle: {
    ...typography.h4,
    color: colors.slate[800],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  errorText: {
    ...typography.body,
    color: colors.slate[500],
    textAlign: 'center',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
    gap: spacing.lg,
  },
  qrSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  publicHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  publicTitle: {
    ...typography.h3,
    color: colors.slate[800],
  },
  publicFolio: {
    ...typography.smallBold,
    color: colors.slate[400],
    fontFamily: 'monospace',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.slate[800],
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    ...typography.body,
    color: colors.slate[500],
    flex: 1,
  },
  infoValue: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate[100],
    marginVertical: spacing.md,
  },
  notesText: {
    ...typography.small,
    color: colors.slate[600],
    fontStyle: 'italic',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    ...typography.bodyBold,
  },
  expirationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  expirationLabel: {
    ...typography.small,
    color: colors.slate[500],
  },
  changeTitle: {
    ...typography.smallBold,
    color: colors.slate[700],
    marginBottom: spacing.sm,
  },
  commentInput: {
    ...typography.small,
    color: colors.slate[700],
    backgroundColor: colors.slate[50],
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    minHeight: 40,
  },
  changeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  changeBtnText: {
    ...typography.smallBold,
    color: colors.white,
  },
  lockedHint: {
    ...typography.caption,
    color: colors.slate[400],
    fontStyle: 'italic',
  },
  historyEntry: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.info,
    marginTop: 6,
  },
  historyContent: {
    flex: 1,
  },
  historyText: {
    ...typography.smallBold,
    color: colors.slate[700],
  },
  historyDate: {
    ...typography.caption,
    color: colors.slate[400],
    marginTop: 2,
  },
  historyComment: {
    ...typography.caption,
    color: colors.slate[500],
    fontStyle: 'italic',
    marginTop: 2,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: radii.md,
    marginRight: spacing.sm,
  },
});
