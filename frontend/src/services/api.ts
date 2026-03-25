import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// For Expo Go on a device, replace with your computer's local IP (e.g., http://192.168.1.X:3000/api/v1)
// 'localhost' works on iOS simulator. Use 10.0.2.2 on Android emulator.
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

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
  if (amenities.isInBathroom) result.push('Dentro de un Baño');
  if (amenities.isOpen) result.push('Abierto');
  return result;
};

export const verifyEmail = async (email: string, otp: string) => {
  const response = await api.post('/auth/verify-email', { email, otp });
  return response.data;
};

export const resendVerification = async (email: string) => {
  const response = await api.post('/auth/resend-verification', { email });
  return response.data;
};

export const getLactarios = async (filters?: { status?: string; verified?: boolean; search?: string; mine?: boolean }) => {
  const response = await api.get('/lactarios', { params: filters });
  return response.data.map((l: any) => ({
    ...l,
    amenities: mapAmenityObjectToArray(l.amenities),
    access: l.genderAccess,
  }));
};

// Normalizes a backend review object to the frontend Review shape.
const mapReview = (r: any) => ({
  ...r,
  userName: r.user?.name || r.user?.email?.split('@')[0] || r.userName || 'Usuario',
  userAvatarUrl: r.user?.avatarUrl || r.userAvatarUrl || null,
  date: r.createdAt || r.date || new Date().toISOString(),
});

export const getLactarioById = async (id: string) => {
  const response = await api.get(`/lactarios/${id}`);
  const l = response.data;
  return {
    ...l,
    amenities: mapAmenityObjectToArray(l.amenities),
    reviews: Array.isArray(l.reviews) ? l.reviews.map(mapReview) : [],
    access: l.genderAccess,
  };
};

export const createLactario = async (data: {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  description?: string;
  amenities?: string[];
  tags?: string[];
  placeType?: string;
  genderAccess?: string;
  isPrivate?: boolean;
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

export const updateReview = async (id: string, data: { rating: number; comment: string }) => {
  const response = await api.put(`/reviews/${id}`, data);
  return response.data;
};

export const reportReview = async (id: string, reason?: string) => {
  const response = await api.post(`/reviews/${id}/report`, { reason });
  return response.data;
};

export const getReportedReviews = async () => {
  const response = await api.get('/reviews/reported');
  return response.data.map((r: any) => ({
    ...r,
    userName: r.user?.name || r.user?.email?.split('@')[0] || 'Usuario',
    date: r.createdAt,
  }));
};

export const unhideReview = async (id: string) => {
  const response = await api.put(`/reviews/${id}/unhide`);
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

// === Babies ===

export const getBabiesFromServer = async () => {
  const response = await api.get('/babies');
  return response.data;
};

export const createBabyOnServer = async (data: { name: string; birthDate?: string; notes?: string }) => {
  const response = await api.post('/babies', data);
  return response.data;
};

export const updateBabyOnServer = async (id: string, data: { name?: string; birthDate?: string; notes?: string }) => {
  const response = await api.put(`/babies/${id}`, data);
  return response.data;
};

export const deleteBabyFromServer = async (id: string) => {
  const response = await api.delete(`/babies/${id}`);
  return response.data;
};

// === Nursing Sessions ===

export const getNursingSessionsFromServer = async (filters?: { babyId?: string; date?: string }) => {
  const response = await api.get('/nursing-sessions', { params: filters });
  return response.data;
};

export const createNursingSessionOnServer = async (data: {
  babyId?: string;
  startedAt: string;
  endedAt: string;
  leftDuration: number;
  rightDuration: number;
  totalDuration: number;
  totalPauseTime: number;
  lastSide: string;
  notes?: string;
}) => {
  const response = await api.post('/nursing-sessions', data);
  return response.data;
};

export const deleteNursingSessionFromServer = async (id: string) => {
  const response = await api.delete(`/nursing-sessions/${id}`);
  return response.data;
};

// === Submissions (Admin/Elite) ===

export const getSubmissions = async (status?: 'PENDING' | 'APPROVED' | 'REJECTED') => {
  const response = await api.get('/submissions', { params: status ? { status } : undefined });
  return response.data;
};

export const approveSubmission = async (id: string) => {
  const response = await api.put(`/submissions/${id}/approve`);
  return response.data;
};

export const rejectSubmission = async (id: string, data: { rejectionReason: string; rejectionNotes?: string }) => {
  const response = await api.put(`/submissions/${id}/reject`, data);
  return response.data;
};

export const editSubmission = async (id: string, data: { name?: string; address?: string; description?: string }) => {
  const response = await api.put(`/submissions/${id}/edit`, data);
  return response.data;
};

// === Photos ===

export const deletePhoto = async (photoId: string) => {
  const response = await api.delete(`/photos/${photoId}`);
  return response.data;
};

export const uploadPhoto = async (lactarioId: string, imageUri: string) => {
  const token = await AsyncStorage.getItem('@Auth:token');
  const formData = new FormData();

  if (typeof document !== 'undefined') {
    // Web: imageUri is an object URL from file input
    const res = await fetch(imageUri);
    const blob = await res.blob();
    formData.append('photo', blob, 'photo.jpg');
  } else {
    // Native: imageUri is a file path
    formData.append('photo', { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  }

  const response = await fetch(`${BASE_URL}/lactarios/${lactarioId}/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) throw new Error('Error uploading photo');
  return response.json();
};

export const uploadAvatar = async (imageUri: string): Promise<{ avatarUrl: string }> => {
  const token = await AsyncStorage.getItem('@Auth:token');
  const formData = new FormData();

  if (typeof document !== 'undefined') {
    const res = await fetch(imageUri);
    const blob = await res.blob();
    formData.append('avatar', blob, 'avatar.jpg');
  } else {
    formData.append('avatar', { uri: imageUri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
  }

  const response = await fetch(`${BASE_URL}/users/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) throw new Error('Error uploading avatar');
  return response.json();
};

// === Floors ===

export const createFloor = async (parentId: string, data: {
  floor: string;
  description?: string;
  amenities?: string[];
  placeType?: string;
  genderAccess?: string;
  isPrivate?: boolean;
}) => {
  const response = await api.post(`/lactarios/${parentId}/floors`, data);
  return response.data;
};

// === Direct update (ADMIN/ELITE only) ===

export const updateLactario = async (id: string, data: {
  name?: string; address?: string; description?: string; amenities?: string[]; tags?: string[];
}) => {
  const response = await api.put(`/lactarios/${id}`, data);
  return response.data;
};

export const deleteLactario = async (id: string) => {
  const response = await api.delete(`/lactarios/${id}`);
  return response.data;
};

export const verifyLactario = async (id: string) => {
  const response = await api.put(`/lactarios/${id}/verify`);
  return response.data;
};

export const unverifyLactario = async (id: string) => {
  const response = await api.put(`/lactarios/${id}/unverify`);
  return response.data;
};

// === Edit Proposals ===

export const createEditProposal = async (data: {
  lactarioId: string; name?: string; address?: string; description?: string; amenities?: string[]; tags?: string[];
}) => {
  const response = await api.post('/edit-proposals', data);
  return response.data;
};

export const getEditProposals = async (params?: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' }) => {
  const response = await api.get('/edit-proposals', { params });
  return response.data;
};

export const approveEditProposal = async (id: string) => {
  const response = await api.put(`/edit-proposals/${id}/approve`);
  return response.data;
};

export const rejectEditProposal = async (id: string, data: { rejectionNotes?: string }) => {
  const response = await api.put(`/edit-proposals/${id}/reject`, data);
  return response.data;
};

// === Pumping Sessions ===

export const getPumpingSessions = async (filters?: { date?: string; babyId?: string }) => {
  const response = await api.get('/pumping-sessions', { params: filters });
  return response.data;
};

export const getPumpingSession = async (id: string) => {
  const response = await api.get(`/pumping-sessions/${id}`);
  return response.data;
};

export const createPumpingSession = async (data: {
  side: string;
  pumpedAt: string;
  amountMl: number;
  notes?: string;
  babyId?: string | null;
}) => {
  const response = await api.post('/pumping-sessions', data);
  return response.data;
};

export const updatePumpingSession = async (id: string, data: {
  side?: string;
  pumpedAt?: string;
  amountMl?: number;
  notes?: string;
  babyId?: string | null;
}) => {
  const response = await api.put(`/pumping-sessions/${id}`, data);
  return response.data;
};

export const deletePumpingSession = async (id: string) => {
  const response = await api.delete(`/pumping-sessions/${id}`);
  return response.data;
};

export const uploadPumpingPhoto = async (sessionId: string, imageUri: string) => {
  const token = await AsyncStorage.getItem('@Auth:token');
  const formData = new FormData();

  if (typeof document !== 'undefined') {
    const res = await fetch(imageUri);
    const blob = await res.blob();
    formData.append('photo', blob, 'photo.jpg');
  } else {
    formData.append('photo', { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  }

  const response = await fetch(`${BASE_URL}/pumping-sessions/${sessionId}/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) throw new Error('Error uploading photo');
  return response.json();
};

export const deletePumpingPhoto = async (sessionId: string, photoId: string) => {
  const response = await api.delete(`/pumping-sessions/${sessionId}/photos/${photoId}`);
  return response.data;
};

export default api;
