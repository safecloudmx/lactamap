import 'react-native-gesture-handler';
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { SleepTimerProvider } from './src/context/SleepTimerContext';
import { AppNavigator } from './src/navigation/AppNavigator';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScrollView style={styles.errorContainer} contentContainerStyle={styles.errorContent}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{this.state.error?.message}</Text>
          <Text style={styles.errorStack}>{this.state.error?.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: { flex: 1, backgroundColor: '#fee2e2' },
  errorContent: { padding: 24, paddingTop: 60 },
  errorTitle: { fontSize: 22, fontWeight: '700', color: '#dc2626', marginBottom: 12 },
  errorMessage: { fontSize: 16, color: '#991b1b', marginBottom: 16 },
  errorStack: { fontSize: 12, color: '#7f1d1d', fontFamily: 'monospace' },
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
          <SleepTimerProvider>
            <AppNavigator />
          </SleepTimerProvider>
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
