import React, { useState, useCallback } from 'react';
import {
  SectionList,
  RefreshControl,
  Platform,
  StyleSheet,
  SectionListProps,
  DefaultSectionT,
} from 'react-native';

type RefreshableSectionListProps<ItemT, SectionT = DefaultSectionT> = SectionListProps<ItemT, SectionT> & {
  onRefresh: () => Promise<void>;
};

/**
 * Reusable pull-to-refresh SectionList wrapper.
 * Drop-in replacement for SectionList with pull-to-refresh support.
 */
export default function RefreshableSectionList<ItemT, SectionT = DefaultSectionT>({
  onRefresh,
  ...sectionListProps
}: RefreshableSectionListProps<ItemT, SectionT>) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return (
    <SectionList<ItemT, SectionT>
      {...(sectionListProps as any)}
      style={[
        sectionListProps.style,
        Platform.OS === 'web' && styles.webScroll,
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={['#f43f5e']}
          tintColor="#f43f5e"
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  webScroll: {
    // @ts-ignore — web-only CSS property
    overscrollBehaviorY: 'contain',
  },
});
