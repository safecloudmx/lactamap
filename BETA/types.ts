export enum ViewState {
  MAP = 'MAP',
  LIST = 'LIST',
  ADD = 'ADD',
  PROFILE = 'PROFILE',
  DETAILS = 'DETAILS'
}

export enum GenderAccess {
  WOMEN = 'Mujeres',
  MEN = 'Hombres',
  NEUTRAL = 'Unisex/Familiar'
}

export enum Amenity {
  CHANGING_TABLE = 'Cambiador',
  LACTATION_CHAIR = 'Sillón Lactancia',
  SINK = 'Lavabo',
  MICROWAVE = 'Microondas',
  ELECTRIC_OUTLET = 'Enchufe',
  PRIVATE_ROOM = 'Sala Privada',
  REFRIGERATOR = 'Refrigerador',
  FREEZER = 'Congelador',
  AC = 'Clima (A/C)'
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface LactationRoom {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
  rating: number;
  reviews: Review[];
  amenities: Amenity[];
  access: GenderAccess;
  imageUrl?: string;
  isVerified?: boolean;
  createdBy?: string; // userId
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

// Gamification Types
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  threshold: number; // required count
  type: 'submission' | 'review';
}

export interface User {
  id: string;
  name: string;
  email: string;
  points: number;
  level: number;
  badges: string[]; // IDs of unlocked badges
  stats: {
    roomsAdded: number;
    reviewsWritten: number;
  };
}
