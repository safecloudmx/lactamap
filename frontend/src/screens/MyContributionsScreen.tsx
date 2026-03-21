import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { FolderHeart, Clock, CheckCircle, XCircle, ChevronRight } from 'lucide-react-native';
import { getLactarios } from '../services/api';
import LactarioCard from '../components/LactarioCard';
import { AppHeader, EmptyState } from '../components/ui';
import { colors, spacing, typography, radii } from '../theme';

const REJECTION_REASON_LABELS: Record<string, string> = {
  OBSCENE_CONTENT: 'Contenido obsceno',
  INCORRECT_CONTENT: 'Contenido erróneo',
  INTERNAL_TEST: 'Prueba interna',
  DUPLICATE: 'Duplicado',
  LOW_QUALITY_PHOTO: 'Foto de baja calidad',
  INCORRECT_LOCATION: 'Ubicación incorrecta',
  OTHER: 'Otro',
};

type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface SubmissionInfo {
  id: string;
  status: SubmissionStatus;
  rejectionReason?: string;
  rejectionNotes?: string;
  createdAt: string;
}

interface LactarioWithSubmission {
  id: string;
  name: string;
  address?: string;
  status: string;
  submission?: SubmissionInfo;
  [key: string]: any;
}

function SubmissionBadge({ submission }: { submission?: SubmissionInfo }) {
  if (!submission) return null;

  if (submission.status === 'PENDING') {
    return (
      <View style={[styles.badge, styles.badgePending]}>
        <Clock size={12} color={colors.warning} />
        <Text style={[styles.badgeText, { color: colors.warning }]}>En revisión</Text>
      </View>
    );
  }

  if (submission.status === 'APPROVED') {
    return (
      <View style={[styles.badge, styles.badgeApproved]}>
        <CheckCircle size={12} color={colors.success} />
        <Text style={[styles.badgeText, { color: colors.success }]}>Aprobado</Text>
      </View>
    );
  }

  if (submission.status === 'REJECTED') {
    return (
      <View style={styles.rejectionContainer}>
        <View style={[styles.badge, styles.badgeRejected]}>
          <XCircle size={12} color={colors.error} />
          <Text style={[styles.badgeText, { color: colors.error }]}>Rechazado</Text>
        </View>
        {submission.rejectionReason && (
          <Text style={styles.rejectionReason}>
            Motivo: {REJECTION_REASON_LABELS[submission.rejectionReason] ?? submission.rejectionReason}
          </Text>
        )}
        {submission.rejectionNotes && (
          <Text style={styles.rejectionNotes}>{submission.rejectionNotes}</Text>
        )}
      </View>
    );
  }

  return null;
}

export default function MyContributionsScreen() {
  const navigation = useNavigation<any>();

  const [lactarios, setLactarios] = useState<LactarioWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchContributions = useCallback(async () => {
    try {
      const data = await getLactarios({ mine: true });
      setLactarios(data);
    } catch (error) {
      console.warn('Error fetching contributions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchContributions();
    }, [fetchContributions])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchContributions();
  };

  const handleCardPress = (room: LactarioWithSubmission) => {
    navigation.navigate('RoomDetail', { room });
  };

  const renderItem = ({ item }: { item: LactarioWithSubmission }) => (
    <TouchableOpacity onPress={() => handleCardPress(item)} activeOpacity={0.8}>
      <View style={styles.itemWrapper}>
        <LactarioCard
          lactario={item}
          onPress={() => handleCardPress(item)}
          showStatus
        />
        {item.submission && (
          <View style={styles.submissionRow}>
            <SubmissionBadge submission={item.submission} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <AppHeader
        title="Mis Aportes"
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : (
        <FlatList
          data={lactarios}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            lactarios.length === 0 && styles.emptyList,
          ]}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <EmptyState
              icon={<FolderHeart size={32} color={colors.primary[500]} />}
              title="Aún no has agregado lactarios"
              subtitle="Cuando agregues un lactario, aparecerá aquí."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  emptyList: {
    flexGrow: 1,
  },
  itemWrapper: {
    marginBottom: spacing.sm,
  },
  submissionRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    marginTop: -spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    gap: 4,
  },
  badgePending: {
    backgroundColor: colors.warningLight,
  },
  badgeApproved: {
    backgroundColor: colors.successLight,
  },
  badgeRejected: {
    backgroundColor: colors.errorLight,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  rejectionContainer: {
    gap: spacing.xs,
  },
  rejectionReason: {
    ...typography.caption,
    color: colors.error,
    marginLeft: 4,
  },
  rejectionNotes: {
    ...typography.caption,
    color: colors.slate[500],
    fontStyle: 'italic',
    marginLeft: 4,
  },
});
