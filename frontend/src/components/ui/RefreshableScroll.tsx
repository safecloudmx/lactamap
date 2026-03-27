import React, { useState, useCallback } from 'react';
import {
  ScrollView,
  RefreshControl,
  Platform,
  StyleSheet,
  ViewStyle,
  ScrollViewProps,
} from 'react-native';

interface RefreshableScrollProps extends ScrollViewProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  contentContainerStyle?: ViewStyle;
}

/**
 * Reusable pull-to-refresh wrapper.
 * - Native: uses RefreshControl on ScrollView.
 * - Web: uses a CSS overscroll-behavior trick + RefreshControl polyfill.
 */
export default function RefreshableScroll({
  onRefresh,
  children,
  contentContainerStyle,
  ...scrollProps
}: RefreshableScrollProps) {
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
    <ScrollView
      {...scrollProps}
      contentContainerStyle={contentContainerStyle}
      style={[
        scrollProps.style,
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
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  webScroll: {
    // Allow browser pull-to-refresh gesture to propagate on web
    // @ts-ignore — web-only CSS property
    overscrollBehaviorY: 'contain',
  },
});
