import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// For Expo Go on a device, replace with your computer's local IP (e.g., http://192.168.1.X:3000/api/v1)
// 'localhost' works on iOS simulator. Use 10.0.2.2 on Android emulator.
const BASE_URL = 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('@Auth:token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Converts the DB amenity object { hasFridge, hasPower, ... } to the
// Amenity enum value array that frontend components expect (Spanish strings).
const mapAmenityObjectToArray = (amenities: any): string[] => {
  if (!amenities || typeof amenities !== 'object') return [];
  if (Array.isArray(amenities)) return amenities;
  const result: string[] = [];
  if (amenities.hasFridge) result.push('Refrigerador');
  if (amenities.hasPower) result.push('Enchufe');
  if (amenities.hasSink) result.push('Lavabo');
  if (amenities.hasPrivacy) result.push('Sala Privada');
  if (amenities.hasNursingChair) result.push('Sillón Lactancia');
  if (amenities.hasAC) result.push('Clima (A/C)');
  return result;
};

export const getLactarios = async (filters?: { status?: string; verified?: boolean; search?: string; mine?: boolean }) => {
  const response = await api.get('/lactarios', { params: filters });
  return response.data.map((l: any) => ({
    ...l,
    amenities: mapAmenityObjectToArray(l.amenities),
  }));
};

// Normalizes a backend review object to the frontend Review shape.
const mapReview = (r: any) => ({
  ...r,
  userName: r.user?.name || r.user?.email?.split('@')[0] || r.userName || 'Usuario',
  date: r.createdAt || r.date || new Date().toISOString(),
});

export const getLactarioById = async (id: string) => {
  const response = await api.get(`/lactarios/${id}`);
  const l = response.data;
  return {
    ...l,
    amenities: mapAmenityObjectToArray(l.amenities),
    reviews: Array.isArray(l.reviews) ? l.reviews.map(mapReview) : [],
  };
};

export const createLactario = async (data: {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  description?: string;
  amenities?: string[];
}) => {
  const response = await api.post('/lactarios', data);
  return response.data;
};

export const getReviews = async (lactarioId: string) => {
  const response = await api.get(`/reviews/lactario/${lactarioId}`);
  return response.data.map(mapReview);
};

export const createReview = async (lactarioId: string, data: { rating: number; comment: string }) => {
  const response = await api.post(`/reviews/lactario/${lactarioId}`, data);
  return response.data;
};

export const deleteReview = async (id: string) => {
  const response = await api.delete(`/reviews/${id}`);
  return response.data;
};

export const getUserProfile = async () => {
  const response = await api.get('/users/profile');
  return response.data;
};

export const getLeaderboard = async () => {
  const response = await api.get('/users/leaderboard');
  return response.data;
};

export const updateUserProfile = async (data: { name: string }) => {
  const response = await api.put('/users/profile', data);
  return response.data;
};

export default api;
