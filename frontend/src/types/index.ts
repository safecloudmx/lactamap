export type Role = 'VISITOR' | 'CONTRIBUTOR' | 'DISTINGUISHED' | 'ELITE' | 'OWNER' | 'ADMIN';

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
  userAvatarUrl?: string | null;
  rating: number;
  comment: string;
  date: string;
  reportCount?: number;
  isHidden?: boolean;
}

export interface ReportedReview extends Review {
  lactario: { id: string; name: string };
  reports: { id: string; reason?: string; user: { id: string; name?: string; email: string } }[];
}

export interface Lactario {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  description?: string;
  resources?: string[]; // Kept for backward compatibility, mapped to Amenities
  amenities?: Amenity[];
  rating?: number;
  reviewCount?: number;
  comments?: number;
  reviews?: Review[];
  status: 'PENDING' | 'ACTIVE' | 'CLOSED';
  placeType?: 'LACTARIO' | 'CAMBIADOR' | 'BANO_FAMILIAR' | 'PUNTO_INTERES';
  owner?: { id: string; name?: string; email: string };
  access?: GenderAccess;
  imageUrl?: string;
  photos?: { id: string; url: string }[];
  isVerified?: boolean;
  isPrivate?: boolean;
  createdBy?: string;
  tags?: string[];
  // Multi-floor
  parentId?: string | null;
  floor?: string | null;
  parent?: { id: string; name: string; address?: string; latitude: number; longitude: number } | null;
  floors?: LactarioFloor[];
  floorCount?: number;
}

export interface LactarioFloor {
  id: string;
  floor: string;
  description?: string;
  placeType?: string;
  genderAccess?: string;
  isPrivate?: boolean;
  rating?: number;
  reviewCount?: number;
  imageUrl?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  threshold: number;
  type: 'submission' | 'review';
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: Role;
  points: number;
  level?: number;
  avatarUrl?: string | null;
  badges?: any[];
  isGuest?: boolean;
  stats?: {
    roomsAdded: number;
    reviewsWritten: number;
  };
}

export interface EditProposal {
  id: string;
  lactarioId: string;
  lactario?: { id: string; name: string; address?: string; placeType?: string };
  proposedBy?: { id: string; name?: string; email: string; role: string };
  name?: string;
  address?: string;
  description?: string;
  amenities: string[];
  tags: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: { id: string; name?: string; email: string };
  reviewedAt?: string;
  rejectionNotes?: string;
  createdAt: string;
}

// === Nursing Timer Types ===

export interface Baby {
  id: string;
  name: string;
  birthDate?: string | null;
  avatarUrl?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface GrowthPhoto {
  id: string;
  growthRecordId: string;
  url: string;
  createdAt: string;
}

export interface GrowthRecord {
  id: string;
  babyId: string;
  measuredAt: string;
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
  notes: string | null;
  photos: GrowthPhoto[];
  createdAt: string;
  updatedAt: string;
}

export type FeedingSide = 'left' | 'right' | 'both';

export type PumpingSide = 'LEFT' | 'RIGHT' | 'BOTH';
export type StorageStatus = 'FROZEN' | 'REFRIGERATED' | 'CONSUMED';
export type PumpingClassification = 'DAY' | 'NIGHT';

export interface PumpingPhoto {
  id: string;
  url: string;
  createdAt: string;
}

export interface PumpingStatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  comment: string | null;
}

export interface PumpingSession {
  id: string;
  userId: string;
  babyId?: string | null;
  baby?: { id: string; name: string } | null;
  folio?: string | null;
  side: PumpingSide;
  pumpedAt: string;
  amountMl: number;
  storageStatus?: StorageStatus;
  expirationDate?: string | null;
  classification?: PumpingClassification | null;
  notes: string | null;
  photos: PumpingPhoto[];
  statusHistory?: PumpingStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface FeedingSession {
  id: string;
  babyId?: string;
  startedAt: string;
  endedAt: string;
  leftDuration: number;
  rightDuration: number;
  totalDuration: number;
  totalPauseTime: number;
  lastSide: FeedingSide;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SleepSession {
  id: string;
  babyId?: string;
  startedAt: string;
  endedAt: string;
  totalDuration: number;
  totalPauseTime: number;
  notes: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

// === Diaper Record Types ===

export type DiaperType = 'wet' | 'dirty' | 'both';

export interface DiaperRecord {
  id: string;
  babyId?: string;
  type: DiaperType;
  changedAt: string;
  notes: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}
