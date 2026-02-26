import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
import { colors, spacing, typography, radii } from '../theme';
import { Baby } from '../types';
import * as nursingStorage from '../services/nursingStorage';

interface BabySelectorProps {
  selectedBabyId: string | null;
  onSelectBaby: (babyId: string | null) => void;
  onBabyDeleted?: (babyId: string) => void;
}

export default function BabySelector({ selectedBabyId, onSelectBaby, onBabyDeleted }: BabySelectorProps) {
  const [babies, setBabies] = useState<Baby[]>([]);
  const navigation = useNavigation<any>();

  // Reload babies every time the screen regains focus (e.g. after adding in Profile)
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const list = await nursingStorage.getBabies();
        setBabies(list);
      })();
    }, [])
  );

  const handleSelectBaby = async (id: string) => {
    const newId = selectedBabyId === id ? null : id;
    onSelectBaby(newId);
    await nursingStorage.setActiveBabyId(newId);
  };

  const handleAddBabyPress = () => {
    // Navigate to Profile screen where babies are managed
    navigation.navigate('Main', { screen: 'HomeTabs', params: { screen: 'Perfil' } });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Bebe</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {babies.map((baby) => {
          const isSelected = selectedBabyId === baby.id;
          return (
            <TouchableOpacity
              key={baby.id}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => handleSelectBaby(baby.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {baby.name}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.addChip}
          onPress={handleAddBabyPress}
          activeOpacity={0.7}
        >
          <Plus size={16} color={colors.primary[500]} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.smallBold,
    color: colors.slate[700],
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.slate[200],
  },
  chipSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  chipText: {
    ...typography.small,
    color: colors.slate[700],
  },
  chipTextSelected: {
    color: colors.primary[700],
    fontWeight: '600',
  },
  addChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
