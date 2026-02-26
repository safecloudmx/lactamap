import { User, Badge } from '../types';
import { BADGES, POINTS } from '../constants';

export const calculateLevel = (points: number): number => {
  // Simple level calculation: Level 1 = 0-99, Level 2 = 100-199, etc.
  return Math.floor(points / 100) + 1;
};

export const checkNewBadges = (user: User): Badge[] => {
  const newBadges: Badge[] = [];

  BADGES.forEach(badge => {
    if (user.badges.includes(badge.id)) return;

    let unlocked = false;
    
    if (badge.type === 'submission' && user.stats.roomsAdded >= badge.threshold) {
      unlocked = true;
    } else if (badge.type === 'review' && user.stats.reviewsWritten >= badge.threshold) {
      unlocked = true;
    }

    if (unlocked) {
      newBadges.push(badge);
    }
  });

  return newBadges;
};

interface UpdateResult {
  user: User;
  newBadges: Badge[];
}

export const addPoints = (user: User, amount: number, actionType?: 'ROOM' | 'REVIEW'): UpdateResult => {
  const updatedUser = { ...user };
  updatedUser.points += amount;
  updatedUser.level = calculateLevel(updatedUser.points);

  if (actionType === 'ROOM') {
    updatedUser.stats.roomsAdded += 1;
  } else if (actionType === 'REVIEW') {
    updatedUser.stats.reviewsWritten += 1;
  }

  const unlockedBadges = checkNewBadges(updatedUser);
  if (unlockedBadges.length > 0) {
    updatedUser.badges = [...updatedUser.badges, ...unlockedBadges.map(b => b.id)];
  }

  return {
    user: updatedUser,
    newBadges: unlockedBadges
  };
};

// Helper to create a new user
export const createNewUser = (name: string, email: string): User => ({
  id: Date.now().toString(),
  name,
  email,
  points: 0,
  level: 1,
  badges: [],
  stats: {
    roomsAdded: 0,
    reviewsWritten: 0
  }
});
