import React, { useState, useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  Platform,
  StyleSheet,
  FlatListProps,
} from 'react-native';

type RefreshableFlatListProps<T> = FlatListProps<T> & {
  onRefresh: () => Promise<void>;
};

/**
 * Reusable pull-to-refresh FlatList wrapper.
 * Drop-in replacement for FlatList with pull-to-refresh support.
 */
export default function RefreshableFlatList<T>({
  onRefresh,
  ...flatListProps
}: RefreshableFlatListProps<T>) {
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
    <FlatList
      {...flatListProps}
      style={[
        flatListProps.style,
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
