import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { User } from '../types';

interface AuthContextData {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  register: (email: string, pass: string, name?: string) => Promise<void>;
  guestLogin: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStorageData() {
      const storedUser = await AsyncStorage.getItem('@Auth:user');
      const storedToken = await AsyncStorage.getItem('@Auth:token');

      if (storedUser && storedToken) {
        const cached = JSON.parse(storedUser);
        setUser(cached);
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

        // Refresh profile from server to pick up role/points changes
        if (!cached.isGuest) {
          try {
            const { data: fresh } = await api.get('/users/profile');
            const merged = { ...cached, ...fresh };
            setUser(merged);
            await AsyncStorage.setItem('@Auth:user', JSON.stringify(merged));
          } catch (_) {
            // offline / expired — keep cached data
          }
        }
      }
      setLoading(false);
    }

    loadStorageData();
  }, []);

  async function signIn(email: string, pass: string) {
    const response = await api.post('/auth/login', { email, password: pass });
    const { token, user: userData } = response.data;

    // Clear old nursing/local data before setting new user
    await AsyncStorage.removeItem('@Nursing:babies');
    await AsyncStorage.removeItem('@Nursing:sessions');
    await AsyncStorage.removeItem('@Nursing:activeBaby');

    await AsyncStorage.setItem('@Auth:user', JSON.stringify(userData));
    await AsyncStorage.setItem('@Auth:token', token);

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  }

  async function signOut() {
    await AsyncStorage.removeItem('@Auth:token');
    await AsyncStorage.removeItem('@Auth:user');
    // Clear nursing/local data
    await AsyncStorage.removeItem('@Nursing:babies');
    await AsyncStorage.removeItem('@Nursing:sessions');
    await AsyncStorage.removeItem('@Nursing:activeBaby');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  }

  async function register(email: string, pass: string, name?: string) {
    const response = await api.post('/auth/register', { email, password: pass, name });
    const { token, user: userData } = response.data;

    // Clear old nursing/local data before setting new user
    await AsyncStorage.removeItem('@Nursing:babies');
    await AsyncStorage.removeItem('@Nursing:sessions');
    await AsyncStorage.removeItem('@Nursing:activeBaby');

    await AsyncStorage.setItem('@Auth:user', JSON.stringify(userData));
    await AsyncStorage.setItem('@Auth:token', token);

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  }

  async function updateUser(updates: Partial<User>) {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    await AsyncStorage.setItem('@Auth:user', JSON.stringify(updated));
  }

  async function guestLogin() {
    const guestUser: User = {
      id: 'guest-id-' + Date.now(),
      email: 'invitado@lactamap.com',
      name: 'Invitado',
      role: 'VISITOR',
      points: 0,
      level: 1,
      badges: [],
      isGuest: true,
      stats: {
        roomsAdded: 0,
        reviewsWritten: 0,
      },
    };
    setUser(guestUser);
    await AsyncStorage.setItem('@Auth:user', JSON.stringify(guestUser));
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, register, guestLogin, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
