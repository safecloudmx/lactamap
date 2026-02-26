import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { FloatingActionButton } from '../components/ui';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isGuest = user?.isGuest === true;

  return (
    <View style={styles.container}>
      {children}
      {!isGuest && (
        <FloatingActionButton onPress={() => navigation.navigate('AddRoomModal')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
