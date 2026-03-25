import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Calendar, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { Baby } from '../types';
import * as nursingStorage from '../services/nursingStorage';
import { confirmAlert, infoAlert } from '../services/crossPlatformAlert';

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MONTHS_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

function CalendarPicker({ selected, onSelect }: {
  selected: Date | null;
  onSelect: (d: Date) => void;
}) {
  const today = new Date();
  const initial = selected || today;
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [showYearGrid, setShowYearGrid] = useState(false);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Monday=0 based: what day of week does the 1st fall on?
  const firstDayRaw = new Date(viewYear, viewMonth, 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1; // shift so Monday=0

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const isSelected = (day: number) =>
    selected &&
    selected.getDate() === day &&
    selected.getMonth() === viewMonth &&
    selected.getFullYear() === viewYear;

  const isToday = (day: number) =>
    today.getDate() === day &&
    today.getMonth() === viewMonth &&
    today.getFullYear() === viewYear;

  const isFuture = (day: number) =>
    new Date(viewYear, viewMonth, day) > today;

  // Build calendar grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Year grid: show range around current year
  const currentYear = today.getFullYear();
  const yearStart = currentYear - 7;
  const yearList = Array.from({ length: 16 }, (_, i) => yearStart + i);

  if (showYearGrid) {
    return (
      <View style={calStyles.container}>
        <View style={calStyles.monthHeader}>
          <TouchableOpacity onPress={() => setShowYearGrid(false)}>
            <ChevronLeft size={22} color={colors.slate[600]} />
          </TouchableOpacity>
          <Text style={calStyles.monthTitle}>Seleccionar Año</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={calStyles.yearGrid}>
          {yearList.map((y) => (
            <TouchableOpacity
              key={y}
              style={[
                calStyles.yearCell,
                y === viewYear && calStyles.yearCellActive,
                y > currentYear && calStyles.yearCellDisabled,
              ]}
              onPress={() => {
                if (y <= currentYear) {
                  setViewYear(y);
                  setShowYearGrid(false);
                }
              }}
              disabled={y > currentYear}
            >
              <Text style={[
                calStyles.yearText,
                y === viewYear && calStyles.yearTextActive,
                y > currentYear && calStyles.yearTextDisabled,
              ]}>
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={calStyles.container}>
      {/* Month/Year header */}
      <View style={calStyles.monthHeader}>
        <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeft size={22} color={colors.slate[600]} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowYearGrid(true)} activeOpacity={0.6}>
          <Text style={calStyles.monthTitle}>
            {MONTHS_ES[viewMonth]} {viewYear}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronRight size={22} color={colors.slate[600]} />
        </TouchableOpacity>
      </View>

      {/* Weekday labels */}
      <View style={calStyles.weekRow}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={calStyles.dayCell}>
            <Text style={calStyles.weekLabel}>{w}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View style={calStyles.grid}>
        {cells.map((day, idx) => (
          <View key={idx} style={calStyles.dayCell}>
            {day ? (
              <TouchableOpacity
                style={[
                  calStyles.dayBtn,
                  isSelected(day) && calStyles.dayBtnSelected,
                  isToday(day) && !isSelected(day) && calStyles.dayBtnToday,
                ]}
                onPress={() => !isFuture(day) && onSelect(new Date(viewYear, viewMonth, day))}
                disabled={isFuture(day)}
                activeOpacity={0.6}
              >
                <Text style={[
                  calStyles.dayText,
                  isSelected(day) && calStyles.dayTextSelected,
                  isToday(day) && !isSelected(day) && calStyles.dayTextToday,
                  isFuture(day) && calStyles.dayTextDisabled,
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>

      {/* Quick month selector */}
      <View style={calStyles.quickMonths}>
        {MONTHS_SHORT.map((m, i) => (
          <TouchableOpacity
            key={m}
            style={[
              calStyles.quickMonthBtn,
              i === viewMonth && calStyles.quickMonthBtnActive,
            ]}
            onPress={() => setViewMonth(i)}
            activeOpacity={0.6}
          >
            <Text style={[
              calStyles.quickMonthText,
              i === viewMonth && calStyles.quickMonthTextActive,
            ]}>
              {m}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const DAY_SIZE = 40;

const calStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  monthTitle: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    marginVertical: 2,
  },
  weekLabel: {
    ...typography.caption,
    color: colors.slate[400],
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayBtn: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnSelected: {
    backgroundColor: colors.primary[500],
  },
  dayBtnToday: {
    backgroundColor: colors.primary[50],
  },
  dayText: {
    ...typography.small,
    color: colors.slate[700],
  },
  dayTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  dayTextToday: {
    color: colors.primary[600],
    fontWeight: '600',
  },
  dayTextDisabled: {
    color: colors.slate[200],
  },
  quickMonths: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  quickMonthBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  quickMonthBtnActive: {
    backgroundColor: colors.primary[50],
  },
  quickMonthText: {
    ...typography.caption,
    color: colors.slate[400],
  },
  quickMonthTextActive: {
    color: colors.primary[600],
    fontWeight: '700',
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  yearCell: {
    width: 70,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  yearCellActive: {
    backgroundColor: colors.primary[500],
  },
  yearCellDisabled: {
    opacity: 0.4,
  },
  yearText: {
    ...typography.body,
    color: colors.slate[700],
  },
  yearTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  yearTextDisabled: {
    color: colors.slate[300],
  },
});

export default function BabyEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { babyId } = route.params;

  const [baby, setBaby] = useState<Baby | null>(null);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const babies = await nursingStorage.getBabies();
        const found = babies.find((b) => b.id === babyId);
        if (found) {
          setBaby(found);
          setName(found.name);
          if (found.birthDate) {
            setBirthDate(new Date(found.birthDate));
          }
          setNotes(found.notes || '');
        }
      })();
    }, [babyId])
  );

  const formatDisplayDate = (d: Date) =>
    `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      infoAlert('Error', 'El nombre debe tener al menos 2 caracteres');
      return;
    }

    setSaving(true);
    try {
      await nursingStorage.updateBaby(babyId, {
        name: trimmedName,
        birthDate: birthDate ? birthDate.toISOString() : null,
        notes: notes.trim() || null,
      });
      navigation.goBack();
    } catch (e) {
      console.warn('Error updating baby:', e);
      infoAlert('Error', 'No se pudo actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    confirmAlert(
      'Eliminar bebé',
      `¿Eliminar a "${baby?.name}" y todos sus registros asociados? Esta acción no se puede deshacer.`,
      async () => {
        try {
          await nursingStorage.deleteBaby(babyId);
          const activeBabyId = await nursingStorage.getActiveBabyId();
          if (activeBabyId === babyId) {
            await nursingStorage.setActiveBabyId(null);
          }
          navigation.pop(2);
        } catch (e) {
          infoAlert('Error', 'No se pudo eliminar');
        }
      }
    );
  };

  if (!baby) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={24} color={colors.slate[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Bebé</Text>
        <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Trash2 size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Name */}
        <View style={styles.inputCard}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nombre del bebé"
            placeholderTextColor={colors.slate[300]}
            maxLength={40}
          />
        </View>

        {/* Birth Date */}
        <View style={styles.inputCard}>
          <View style={styles.labelRow}>
            <Calendar size={16} color={colors.slate[500]} />
            <Text style={styles.label}>Fecha de Nacimiento</Text>
          </View>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
            <Text style={birthDate ? styles.dateButtonText : styles.dateButtonPlaceholder}>
              {birthDate ? formatDisplayDate(birthDate) : 'Seleccionar fecha'}
            </Text>
            <Calendar size={18} color={colors.primary[500]} />
          </TouchableOpacity>
          {birthDate && (
            <TouchableOpacity onPress={() => setBirthDate(null)} style={styles.clearDateBtn}>
              <X size={14} color={colors.slate[400]} />
              <Text style={styles.clearDateText}>Quitar fecha</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Date Picker Modal */}
        <Modal visible={showDatePicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.modalCancel}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Fecha de Nacimiento</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.modalConfirm}>Listo</Text>
                </TouchableOpacity>
              </View>

              <CalendarPicker
                selected={birthDate}
                onSelect={(d) => setBirthDate(d)}
              />

              <TouchableOpacity
                onPress={() => { setBirthDate(null); setShowDatePicker(false); }}
                style={styles.modalClearBtn}
              >
                <Text style={styles.modalClearText}>Sin fecha de nacimiento</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Notes */}
        <View style={styles.inputCard}>
          <Text style={styles.label}>Notas</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notas opcionales..."
            placeholderTextColor={colors.slate[300]}
            multiline
            maxLength={500}
          />
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar Cambios'}</Text>
        </TouchableOpacity>
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
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  inputCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  label: {
    ...typography.smallBold,
    color: colors.slate[700],
    marginBottom: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    color: colors.slate[800],
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  dateButtonText: {
    ...typography.body,
    color: colors.slate[800],
  },
  dateButtonPlaceholder: {
    ...typography.body,
    color: colors.slate[300],
  },
  clearDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  clearDateText: {
    ...typography.caption,
    color: colors.slate[400],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  modalTitle: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  modalCancel: {
    ...typography.body,
    color: colors.slate[500],
  },
  modalConfirm: {
    ...typography.bodyBold,
    color: colors.primary[500],
  },
  modalClearBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  modalClearText: {
    ...typography.small,
    color: colors.slate[400],
    textDecorationLine: 'underline',
  },
  saveBtn: {
    backgroundColor: colors.primary[500],
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.white,
  },
});
