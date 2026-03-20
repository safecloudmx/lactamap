import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  CheckCircle, XCircle, Clock, MapPin, User, Edit3, Flag, EyeOff, Eye, Trash2,
} from 'lucide-react-native';
import {
  getSubmissions, approveSubmission, rejectSubmission,
  getEditProposals, approveEditProposal, rejectEditProposal,
  getReportedReviews, unhideReview, deleteReview,
} from '../services/api';
import { EditProposal, ReportedReview } from '../types';
import { AppHeader, EmptyState } from '../components/ui';
import { colors, spacing, typography, radii, shadows } from '../theme';

const REJECTION_REASONS = [
  { key: 'OBSCENE_CONTENT', label: 'Contenido obsceno', warning: '⚠️ Genera baneo inmediato' },
  { key: 'INCORRECT_CONTENT', label: 'Contenido erróneo', warning: 'Acumula infracciones (5 = suspensión)' },
  { key: 'INCORRECT_LOCATION', label: 'Ubicación incorrecta', warning: '' },
  { key: 'LOW_QUALITY_PHOTO', label: 'Foto de baja calidad', warning: '' },
  { key: 'DUPLICATE', label: 'Duplicado', warning: '' },
  { key: 'INTERNAL_TEST', label: 'Prueba interna', warning: '' },
  { key: 'OTHER', label: 'Otro', warning: '' },
];

type FilterStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type Section = 'submissions' | 'proposals' | 'reports';

interface Submission {
  id: string;
  status: string;
  rejectionReason?: string;
  rejectionNotes?: string;
  createdAt: string;
  reviewedAt?: string;
  lactario: { id: string; name: string; address?: string; description?: string };
  submittedBy: { id: string; name?: string; email: string; role: string };
  reviewedBy?: { id: string; name?: string; email: string };
}

export default function AdminReviewScreen() {
  const navigation = useNavigation<any>();

  // Section switcher
  const [section, setSection] = useState<Section>('submissions');

  // Submissions state
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subFilter, setSubFilter] = useState<FilterStatus>('PENDING');
  const [subLoading, setSubLoading] = useState(true);
  const [subRefreshing, setSubRefreshing] = useState(false);

  // Edit proposals state
  const [proposals, setProposals] = useState<EditProposal[]>([]);
  const [propFilter, setPropFilter] = useState<FilterStatus>('PENDING');
  const [propLoading, setPropLoading] = useState(true);
  const [propRefreshing, setPropRefreshing] = useState(false);

  // Reported reviews state
  const [reportedReviews, setReportedReviews] = useState<ReportedReview[]>([]);
  const [repLoading, setRepLoading] = useState(true);
  const [repRefreshing, setRepRefreshing] = useState(false);

  // Shared reject modal
  const [rejectModal, setRejectModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    try {
      const data = await getSubmissions(subFilter);
      setSubmissions(data);
    } catch (err: any) {
      console.warn('Error fetching submissions:', err);
    } finally {
      setSubLoading(false);
      setSubRefreshing(false);
    }
  }, [subFilter]);

  const fetchProposals = useCallback(async () => {
    try {
      const data = await getEditProposals({ status: propFilter });
      setProposals(data);
    } catch (err: any) {
      console.warn('Error fetching proposals:', err);
    } finally {
      setPropLoading(false);
      setPropRefreshing(false);
    }
  }, [propFilter]);

  const fetchReportedReviews = useCallback(async () => {
    try {
      const data = await getReportedReviews();
      setReportedReviews(data);
    } catch (err: any) {
      console.warn('Error fetching reported reviews:', err);
    } finally {
      setRepLoading(false);
      setRepRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setSubLoading(true);
      setPropLoading(true);
      setRepLoading(true);
      fetchSubmissions();
      fetchProposals();
      fetchReportedReviews();
    }, [fetchSubmissions, fetchProposals, fetchReportedReviews])
  );

  const handleApproveSubmission = (id: string, name: string) => {
    Alert.alert('Aprobar aporte', `¿Confirmas la aprobación de "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprobar', onPress: async () => {
          try { await approveSubmission(id); fetchSubmissions(); }
          catch (err: any) { Alert.alert('Error', err.response?.data?.error || 'No se pudo aprobar'); }
        },
      },
    ]);
  };

  const handleApproveProposal = (id: string, name: string) => {
    Alert.alert('Aprobar propuesta', `¿Aplicar los cambios propuestos para "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprobar', onPress: async () => {
          try { await approveEditProposal(id); fetchProposals(); }
          catch (err: any) { Alert.alert('Error', err.response?.data?.error || 'No se pudo aprobar'); }
        },
      },
    ]);
  };

  const openRejectModal = (id: string) => {
    setSelectedId(id);
    setSelectedReason('');
    setRejectNotes('');
    setRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      if (section === 'submissions') {
        if (!selectedReason) return;
        await rejectSubmission(selectedId, {
          rejectionReason: selectedReason,
          rejectionNotes: rejectNotes.trim() || undefined,
        });
        fetchSubmissions();
      } else {
        await rejectEditProposal(selectedId, { rejectionNotes: rejectNotes.trim() || undefined });
        fetchProposals();
      }
      setRejectModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo rechazar');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return iso; }
  };

  const renderSubmission = ({ item }: { item: Submission }) => {
    const submitterName = item.submittedBy.name || item.submittedBy.email.split('@')[0];
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MapPin size={14} color={colors.primary[500]} />
            <Text style={styles.cardTitle} numberOfLines={1}>{item.lactario.name}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>
        {item.lactario.address ? <Text style={styles.address} numberOfLines={1}>{item.lactario.address}</Text> : null}
        <View style={styles.metaRow}>
          <User size={12} color={colors.slate[400]} />
          <Text style={styles.metaText}>
            {submitterName} · <Text style={styles.roleTag}>{item.submittedBy.role}</Text>
          </Text>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>
        {item.rejectionReason && (
          <View style={styles.rejectionRow}>
            <XCircle size={12} color={colors.error} />
            <Text style={styles.rejectionText}>
              {REJECTION_REASONS.find((r) => r.key === item.rejectionReason)?.label ?? item.rejectionReason}
            </Text>
          </View>
        )}
        {item.reviewedBy && (
          <Text style={styles.reviewedBy}>
            Revisado por {item.reviewedBy.name || item.reviewedBy.email.split('@')[0]}
          </Text>
        )}
        {item.status === 'PENDING' && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApproveSubmission(item.id, item.lactario.name)}>
              <CheckCircle size={16} color={colors.white} />
              <Text style={styles.approveBtnText}>Aprobar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => openRejectModal(item.id)}>
              <XCircle size={16} color={colors.error} />
              <Text style={styles.rejectBtnText}>Rechazar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderProposal = ({ item }: { item: EditProposal }) => {
    const proposerName = item.proposedBy?.name || item.proposedBy?.email.split('@')[0] || 'Usuario';
    const changedFields = [
      item.name && `Nombre: "${item.name}"`,
      item.address && `Dirección: "${item.address}"`,
      item.description !== undefined && item.description !== null && `Descripción actualizada`,
      item.amenities?.length > 0 && `Servicios: ${item.amenities.join(', ')}`,
      item.tags?.length > 0 && `Etiquetas: ${item.tags.join(', ')}`,
    ].filter(Boolean) as string[];

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Edit3 size={14} color='#7c3aed' />
            <Text style={styles.cardTitle} numberOfLines={1}>{item.lactario?.name || 'Lugar'}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>
        {item.lactario?.address ? <Text style={styles.address} numberOfLines={1}>{item.lactario.address}</Text> : null}

        {changedFields.length > 0 && (
          <View style={styles.changesBox}>
            <Text style={styles.changesLabel}>Cambios propuestos:</Text>
            {changedFields.map((f, i) => (
              <Text key={i} style={styles.changeItem}>• {f}</Text>
            ))}
          </View>
        )}

        <View style={styles.metaRow}>
          <User size={12} color={colors.slate[400]} />
          <Text style={styles.metaText}>
            {proposerName} · <Text style={styles.roleTag}>{item.proposedBy?.role}</Text>
          </Text>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>
        {item.rejectionNotes && (
          <View style={styles.rejectionRow}>
            <XCircle size={12} color={colors.error} />
            <Text style={styles.rejectionText}>{item.rejectionNotes}</Text>
          </View>
        )}
        {item.reviewedBy && (
          <Text style={styles.reviewedBy}>
            Revisado por {item.reviewedBy.name || item.reviewedBy.email?.split('@')[0]}
          </Text>
        )}
        {item.status === 'PENDING' && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApproveProposal(item.id, item.lactario?.name || '')}>
              <CheckCircle size={16} color={colors.white} />
              <Text style={styles.approveBtnText}>Aprobar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => openRejectModal(item.id)}>
              <XCircle size={16} color={colors.error} />
              <Text style={styles.rejectBtnText}>Rechazar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const handleUnhideReview = (id: string) => {
    Alert.alert('Restaurar reseña', '¿Quieres restaurar esta reseña y limpiar los reportes?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Restaurar', onPress: async () => {
          try { await unhideReview(id); fetchReportedReviews(); }
          catch { Alert.alert('Error', 'No se pudo restaurar la reseña.'); }
        },
      },
    ]);
  };

  const handleDeleteReportedReview = (id: string) => {
    Alert.alert('Eliminar reseña', '¿Eliminar definitivamente esta reseña?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try { await deleteReview(id); fetchReportedReviews(); }
          catch { Alert.alert('Error', 'No se pudo eliminar la reseña.'); }
        },
      },
    ]);
  };

  const renderReportedReview = ({ item }: { item: ReportedReview }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Flag size={14} color={colors.error} />
          <Text style={styles.cardTitle} numberOfLines={1}>{item.lactario?.name || 'Lugar desconocido'}</Text>
        </View>
        <View style={styles.reportCountBadge}>
          <Text style={styles.reportCountText}>{item.reportCount} reportes</Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <User size={12} color={colors.slate[400]} />
        <Text style={styles.metaText}>{item.userName}</Text>
        <Text style={styles.dateText}>{formatDate(item.date)}</Text>
      </View>
      {item.comment ? <Text style={styles.reviewCommentText} numberOfLines={3}>{item.comment}</Text> : null}
      {item.reports?.length > 0 && (
        <View style={styles.reportReasonsList}>
          {item.reports.slice(0, 3).map((r: any, i: number) => (
            <Text key={i} style={styles.reportReasonItem}>• {r.reason || 'Sin motivo'} ({r.user?.name || r.user?.email?.split('@')[0]})</Text>
          ))}
          {item.reports.length > 3 && <Text style={styles.reportReasonItem}>... y {item.reports.length - 3} más</Text>}
        </View>
      )}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.approveBtn} onPress={() => handleUnhideReview(item.id)}>
          <Eye size={16} color={colors.white} />
          <Text style={styles.approveBtnText}>Restaurar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleDeleteReportedReview(item.id)}>
          <Trash2 size={16} color={colors.error} />
          <Text style={styles.rejectBtnText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const isProposalsSection = section === 'proposals';
  const isReportsSection = section === 'reports';

  return (
    <View style={styles.container}>
      <AppHeader title="Revisión de Aportes" onBack={() => navigation.goBack()} />

      {/* Section switcher */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionScroll} contentContainerStyle={styles.sectionRow}>
        <TouchableOpacity
          style={[styles.sectionTab, section === 'submissions' && styles.sectionTabActive]}
          onPress={() => setSection('submissions')}
        >
          <Text style={[styles.sectionTabText, section === 'submissions' && styles.sectionTabTextActive]}>Aportes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sectionTab, section === 'proposals' && styles.sectionTabActive]}
          onPress={() => setSection('proposals')}
        >
          <Text style={[styles.sectionTabText, section === 'proposals' && styles.sectionTabTextActive]}>Propuestas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sectionTab, section === 'reports' && styles.sectionTabActive]}
          onPress={() => setSection('reports')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Flag size={13} color={isReportsSection ? colors.white : colors.error} />
            <Text style={[styles.sectionTabText, section === 'reports' && styles.sectionTabTextActive]}>Reportes</Text>
            {reportedReviews.length > 0 && (
              <View style={styles.repBadge}><Text style={styles.repBadgeText}>{reportedReviews.length}</Text></View>
            )}
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Status filter tabs (only for submissions/proposals) */}
      {!isReportsSection && (
        <View style={styles.filterRow}>
          {(['PENDING', 'APPROVED', 'REJECTED'] as FilterStatus[]).map((s) => {
            const active = isProposalsSection ? propFilter === s : subFilter === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.filterTab, active && styles.filterTabActive]}
                onPress={() => isProposalsSection ? setPropFilter(s) : setSubFilter(s)}
              >
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                  {s === 'PENDING' ? 'Pendientes' : s === 'APPROVED' ? 'Aprobados' : 'Rechazados'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {isReportsSection ? (
        repLoading ? (
          <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary[500]} /></View>
        ) : (
          <FlatList
            data={reportedReviews}
            keyExtractor={(item) => item.id}
            renderItem={renderReportedReview}
            contentContainerStyle={[styles.list, reportedReviews.length === 0 && styles.emptyList]}
            refreshing={repRefreshing}
            onRefresh={() => { setRepRefreshing(true); fetchReportedReviews(); }}
            ListEmptyComponent={
              <EmptyState icon={<Flag size={32} color={colors.slate[300]} />} title="Sin reportes" subtitle="No hay reseñas reportadas en este momento." />
            }
          />
        )
      ) : !isProposalsSection ? (
        subLoading ? (
          <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary[500]} /></View>
        ) : (
          <FlatList
            data={submissions}
            keyExtractor={(item) => item.id}
            renderItem={renderSubmission}
            contentContainerStyle={[styles.list, submissions.length === 0 && styles.emptyList]}
            refreshing={subRefreshing}
            onRefresh={() => { setSubRefreshing(true); fetchSubmissions(); }}
            ListEmptyComponent={
              <EmptyState icon={<Clock size={32} color={colors.slate[300]} />} title="Sin solicitudes"
                subtitle={`No hay aportes ${subFilter === 'PENDING' ? 'pendientes' : subFilter === 'APPROVED' ? 'aprobados' : 'rechazados'}.`} />
            }
          />
        )
      ) : (
        propLoading ? (
          <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary[500]} /></View>
        ) : (
          <FlatList
            data={proposals}
            keyExtractor={(item) => item.id}
            renderItem={renderProposal}
            contentContainerStyle={[styles.list, proposals.length === 0 && styles.emptyList]}
            refreshing={propRefreshing}
            onRefresh={() => { setPropRefreshing(true); fetchProposals(); }}
            ListEmptyComponent={
              <EmptyState icon={<Edit3 size={32} color={colors.slate[300]} />} title="Sin propuestas"
                subtitle={`No hay propuestas de edición ${propFilter === 'PENDING' ? 'pendientes' : propFilter === 'APPROVED' ? 'aprobadas' : 'rechazadas'}.`} />
            }
          />
        )
      )}

      {/* Reject modal */}
      <Modal visible={rejectModal} transparent animationType="slide" onRequestClose={() => setRejectModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Motivo de rechazo</Text>

            {/* Submission rejection reasons */}
            {!isProposalsSection && (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.reasonList}>
                {REJECTION_REASONS.map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.reasonItem, selectedReason === r.key && styles.reasonItemSelected]}
                    onPress={() => setSelectedReason(r.key)}
                  >
                    <View style={[styles.radioCircle, selectedReason === r.key && styles.radioCircleActive]}>
                      {selectedReason === r.key && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.reasonTextBlock}>
                      <Text style={[styles.reasonLabel, selectedReason === r.key && styles.reasonLabelActive]}>{r.label}</Text>
                      {!!r.warning && <Text style={styles.reasonWarning}>{r.warning}</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TextInput
              style={styles.notesInput}
              placeholder={isProposalsSection ? 'Explica por qué se rechaza la propuesta...' : 'Notas adicionales (opcional)'}
              placeholderTextColor={colors.slate[400]}
              value={rejectNotes}
              onChangeText={setRejectNotes}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRejectModal(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectConfirmBtn, (!isProposalsSection && !selectedReason) && styles.rejectConfirmBtnDisabled]}
                onPress={handleRejectConfirm}
                disabled={(!isProposalsSection && !selectedReason) || submitting}
              >
                {submitting
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Text style={styles.rejectConfirmBtnText}>Rechazar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'PENDING') return (
    <View style={[sBadge.base, sBadge.pending]}>
      <Clock size={11} color={colors.warning} />
      <Text style={[sBadge.text, { color: colors.warning }]}>Pendiente</Text>
    </View>
  );
  if (status === 'APPROVED') return (
    <View style={[sBadge.base, sBadge.approved]}>
      <CheckCircle size={11} color={colors.success} />
      <Text style={[sBadge.text, { color: colors.success }]}>Aprobado</Text>
    </View>
  );
  return (
    <View style={[sBadge.base, sBadge.rejected]}>
      <XCircle size={11} color={colors.error} />
      <Text style={[sBadge.text, { color: colors.error }]}>Rechazado</Text>
    </View>
  );
}

const sBadge = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  pending: { backgroundColor: colors.warningLight },
  approved: { backgroundColor: colors.successLight },
  rejected: { backgroundColor: colors.errorLight },
  text: { ...typography.caption, fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate[50] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionScroll: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate[100] },
  sectionRow: {
    flexDirection: 'row',
  },
  sectionTab: {
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center',
    borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  sectionTabActive: { borderBottomColor: colors.primary[500] },
  sectionTabText: { ...typography.small, color: colors.slate[500] },
  sectionTabTextActive: { ...typography.smallBold, color: colors.primary[500] },
  repBadge: { backgroundColor: colors.error, borderRadius: 99, paddingHorizontal: 5, paddingVertical: 1 },
  repBadgeText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  reportCountBadge: { backgroundColor: '#fee2e2', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.full },
  reportCountText: { ...typography.caption, color: colors.error, fontWeight: '700' },
  reviewCommentText: { ...typography.small, color: colors.slate[600], marginTop: spacing.xs },
  reportReasonsList: { gap: 2, marginTop: spacing.xs },
  reportReasonItem: { ...typography.caption, color: colors.slate[500] },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.slate[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  filterTab: {
    flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  filterTabActive: { borderBottomColor: colors.primary[400] },
  filterTabText: { ...typography.caption, color: colors.slate[400] },
  filterTabTextActive: { ...typography.captionBold, color: colors.primary[500] },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  emptyList: { flexGrow: 1 },
  card: {
    backgroundColor: colors.white, borderRadius: radii.lg,
    padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1, marginRight: spacing.sm },
  cardTitle: { ...typography.smallBold, color: colors.slate[800], flex: 1 },
  address: { ...typography.caption, color: colors.slate[500], marginBottom: spacing.sm },
  changesBox: { backgroundColor: colors.slate[50], borderRadius: radii.sm, padding: spacing.sm, marginBottom: spacing.sm },
  changesLabel: { ...typography.caption, color: colors.slate[500], fontWeight: '600', marginBottom: 4 },
  changeItem: { ...typography.caption, color: colors.slate[700] },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  metaText: { ...typography.caption, color: colors.slate[500], flex: 1 },
  roleTag: { fontWeight: '600', color: colors.slate[600] },
  dateText: { ...typography.caption, color: colors.slate[400] },
  rejectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  rejectionText: { ...typography.caption, color: colors.error, flex: 1 },
  reviewedBy: { ...typography.caption, color: colors.slate[400], fontStyle: 'italic', marginBottom: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, backgroundColor: colors.success, paddingVertical: spacing.sm, borderRadius: radii.md,
  },
  approveBtnText: { ...typography.smallBold, color: colors.white },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, backgroundColor: colors.errorLight, paddingVertical: spacing.sm,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.error,
  },
  rejectBtnText: { ...typography.smallBold, color: colors.error },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.xxl, maxHeight: '85%' },
  modalTitle: { ...typography.h4, color: colors.slate[800], marginBottom: spacing.lg },
  reasonList: { maxHeight: 280, marginBottom: spacing.md },
  reasonItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderRadius: radii.md, borderWidth: 1, borderColor: 'transparent', marginBottom: spacing.xs,
  },
  reasonItemSelected: { borderColor: colors.error, backgroundColor: colors.errorLight },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.slate[300], alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioCircleActive: { borderColor: colors.error },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  reasonTextBlock: { flex: 1 },
  reasonLabel: { ...typography.small, color: colors.slate[700] },
  reasonLabelActive: { color: colors.error, fontWeight: '600' },
  reasonWarning: { ...typography.caption, color: colors.warning, marginTop: 2 },
  notesInput: {
    backgroundColor: colors.slate[50], borderWidth: 1, borderColor: colors.slate[200],
    borderRadius: radii.md, padding: spacing.md, fontSize: 14, color: colors.slate[800],
    minHeight: 72, textAlignVertical: 'top', marginBottom: spacing.lg,
  },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.slate[300], alignItems: 'center' },
  cancelBtnText: { ...typography.bodyBold, color: colors.slate[600] },
  rejectConfirmBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radii.md, backgroundColor: colors.error, alignItems: 'center' },
  rejectConfirmBtnDisabled: { backgroundColor: colors.slate[300] },
  rejectConfirmBtnText: { ...typography.bodyBold, color: colors.white },
});
