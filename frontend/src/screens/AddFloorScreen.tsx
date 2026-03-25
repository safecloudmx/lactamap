import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, StyleSheet, Platform, Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Check, Lock, Info, ArrowLeft } from 'lucide-react-native';
import { Amenity, GenderAccess } from '../types';
import { AMENITY_LABELS } from '../constants';
import { createFloor } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { AppHeader, Chip, LoadingOverlay } from '../components/ui';

const CHANGER_SPECS = ['Dentro de un Baño', 'Abierto', 'Privado', 'Lavabo', 'Climatizado'];
const BATHROOM_SPECS = ['Lavabo', 'Cambiador', 'Climatizado', 'Accesible', 'Privado', 'Abierto'];

type PlaceType = 'LACTARIO' | 'CAMBIADOR' | 'BANO_FAMILIAR' | 'PUNTO_INTERES';

export default function AddFloorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const parentId: string = route.params?.parentId;
  const parentName: string = route.params?.parentName || 'Edificio';

  const [placeType, setPlaceType] = useState<PlaceType | null>(null);
  const [floor, setFloor] = useState('');
  const [description, setDescription] = useState('');
  const [accessSelection, setAccessSelection] = useState<string[]>([GenderAccess.NEUTRAL]);
  const [selectedAmenities, setSelectedAmenities] = useState<Amenity[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [selectedBathroomSpecs, setSelectedBathroomSpecs] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [showPrivateInfo, setShowPrivateInfo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isAccessLocked = placeType === 'BANO_FAMILIAR' || placeType === 'LACTARIO';
  const handleAccessToggle = (value: string) => {
    if (isAccessLocked) return;
    if (value === GenderAccess.NEUTRAL) {
      setAccessSelection([GenderAccess.NEUTRAL]);
    } else {
      setAccessSelection((prev) => {
        const withoutNeutral = prev.filter((v) => v !== GenderAccess.NEUTRAL);
        if (withoutNeutral.includes(value)) {
          const result = withoutNeutral.filter((v) => v !== value);
          return result.length === 0 ? [GenderAccess.NEUTRAL] : result;
        }
        return [...withoutNeutral, value];
      });
    }
  };

  const handlePlaceTypeChange = (type: PlaceType) => {
    setPlaceType(type);
    if (type === 'LACTARIO') setAccessSelection([GenderAccess.WOMEN]);
    else if (type === 'BANO_FAMILIAR') setAccessSelection([GenderAccess.NEUTRAL]);
  };

  const genderAccessValue = accessSelection.sort().join(', ');

  const handlePrivateToggle = () => {
    if (!isPrivate) setShowPrivateInfo(true);
    else setIsPrivate(false);
  };

  const canSave = placeType !== null && floor.trim().length >= 1;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const amenities =
        placeType === 'CAMBIADOR' ? selectedSpecs :
        placeType === 'BANO_FAMILIAR' ? selectedBathroomSpecs :
        selectedAmenities.map(String);

      const result = await createFloor(parentId, {
        floor: floor.trim(),
        description: description.trim() || undefined,
        amenities,
        placeType: placeType!,
        genderAccess: genderAccessValue,
        isPrivate,
      });

      if (Platform.OS === 'web') {
        navigation.goBack();
        Alert.alert(
          result.requiresReview ? 'Solicitud enviada' : 'Piso agregado',
          result.requiresReview
            ? 'Tu piso fue enviado y será publicado tras ser aprobado.'
            : 'El piso fue publicado exitosamente.'
        );
      } else {
        Alert.alert(
          result.requiresReview ? 'Enviado para revisión' : '¡Publicado!',
          result.requiresReview
            ? 'Tu piso fue enviado y será publicado tras ser aprobado.'
            : 'El piso fue publicado exitosamente.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || 'No se pudo agregar el piso.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Agregar piso"
        subtitle={parentName}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Floor number */}
        <View style={styles.field}>
          <Text style={styles.label}>Piso / Nivel *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 7, PB, Sótano 1"
            placeholderTextColor={colors.slate[400]}
            value={floor}
            onChangeText={setFloor}
          />
        </View>

        {/* Place type */}
        <View style={styles.field}>
          <Text style={styles.label}>Tipo de lugar *</Text>
          <View style={styles.chipRow}>
            {([
              { key: 'LACTARIO' as PlaceType, label: '🤱 Lactario' },
              { key: 'CAMBIADOR' as PlaceType, label: '🚼 Cambiador' },
              { key: 'BANO_FAMILIAR' as PlaceType, label: '🚻 Baño Familiar' },
            ] as const).map(({ key, label }) => (
              <Chip
                key={key}
                label={label}
                selected={placeType === key}
                onPress={() => handlePlaceTypeChange(key)}
              />
            ))}
          </View>
        </View>

        {/* Gender access */}
        {placeType && placeType !== 'PUNTO_INTERES' && (
          <View style={styles.field}>
            <Text style={styles.label}>Acceso</Text>
            <View style={styles.chipRow}>
              {Object.values(GenderAccess).map((ga) => (
                <Chip
                  key={ga}
                  label={ga}
                  selected={accessSelection.includes(ga)}
                  onPress={() => handleAccessToggle(ga)}
                  disabled={isAccessLocked}
                />
              ))}
            </View>
            {isAccessLocked && (
              <Text style={styles.hint}>
                {placeType === 'LACTARIO' ? 'Los lactarios son exclusivos para mujeres.' : 'Los baños familiares son unisex.'}
              </Text>
            )}
          </View>
        )}

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Descripción (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe este piso..."
            placeholderTextColor={colors.slate[400]}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Amenities — Lactario */}
        {placeType === 'LACTARIO' && (
          <View style={styles.field}>
            <Text style={styles.label}>Comodidades</Text>
            <View style={styles.chipRow}>
              {Object.values(Amenity).map((a) => (
                <Chip
                  key={a}
                  label={AMENITY_LABELS[a] || a}
                  selected={selectedAmenities.includes(a)}
                  onPress={() =>
                    setSelectedAmenities((prev) =>
                      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
                    )
                  }
                />
              ))}
            </View>
          </View>
        )}

        {/* Specs — Cambiador */}
        {placeType === 'CAMBIADOR' && (
          <View style={styles.field}>
            <Text style={styles.label}>Especificaciones</Text>
            <View style={styles.chipRow}>
              {CHANGER_SPECS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={selectedSpecs.includes(s)}
                  onPress={() =>
                    setSelectedSpecs((prev) =>
                      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                    )
                  }
                />
              ))}
            </View>
          </View>
        )}

        {/* Specs — Baño Familiar */}
        {placeType === 'BANO_FAMILIAR' && (
          <View style={styles.field}>
            <Text style={styles.label}>Especificaciones</Text>
            <View style={styles.chipRow}>
              {BATHROOM_SPECS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={selectedBathroomSpecs.includes(s)}
                  onPress={() =>
                    setSelectedBathroomSpecs((prev) =>
                      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                    )
                  }
                />
              ))}
            </View>
          </View>
        )}

        {/* Private toggle */}
        <TouchableOpacity style={styles.privateRow} onPress={handlePrivateToggle} activeOpacity={0.7}>
          <Lock size={18} color={isPrivate ? '#4338ca' : colors.slate[400]} />
          <Text style={[styles.privateLabel, isPrivate && { color: '#4338ca' }]}>
            Acceso restringido
          </Text>
          <View style={[styles.toggle, isPrivate && styles.toggleActive]}>
            <View style={[styles.toggleDot, isPrivate && styles.toggleDotActive]} />
          </View>
        </TouchableOpacity>

        {/* Private info modal */}
        <Modal visible={showPrivateInfo} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Info size={28} color={colors.primary[500]} />
              <Text style={styles.modalTitle}>Acceso restringido</Text>
              <Text style={styles.modalMsg}>
                Marca esta opción si el piso requiere autorización, credencial o acceso especial para ingresar.
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPrivateInfo(false)}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirm} onPress={() => { setIsPrivate(true); setShowPrivateInfo(false); }}>
                  <Text style={styles.modalConfirmText}>Activar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>

      {/* Save button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <Text style={styles.saveBtnText}>Guardando...</Text>
          ) : (
            <>
              <Check size={20} color={colors.white} />
              <Text style={styles.saveBtnText}>Agregar piso</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {isSaving && <LoadingOverlay message="Guardando piso..." />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 100,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    ...typography.smallBold,
    color: colors.slate[700],
  },
  hint: {
    ...typography.caption,
    color: colors.slate[400],
    fontStyle: 'italic',
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.slate[800],
    backgroundColor: colors.white,
  },
  textArea: {
    minHeight: 80,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  privateLabel: {
    ...typography.body,
    color: colors.slate[600],
    flex: 1,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.slate[200],
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#4338ca',
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  toggleDotActive: {
    alignSelf: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.h4,
    color: colors.slate[800],
  },
  modalMsg: {
    ...typography.small,
    color: colors.slate[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    marginTop: spacing.sm,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
  },
  modalCancelText: {
    ...typography.bodyBold,
    color: colors.slate[600],
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
  },
  modalConfirmText: {
    ...typography.bodyBold,
    color: colors.white,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    ...shadows.primary,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.white,
  },
});
