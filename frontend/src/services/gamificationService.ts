import { User, Badge } from '../types';
import { BADGES, POINTS } from '../constants';

export const calculateLevel = (points: number): number => {
  return Math.floor(Math.sqrt(points / 100)) + 1;
};

export const checkBadges = (user: User, actionType: 'submission' | 'review'): Badge[] => {
  const currentBadges = new Set(user.badges || []);
  const newBadges: Badge[] = [];

  BADGES.filter(b => b.type === actionType).forEach(badge => {
    if (currentBadges.has(badge.id)) return;

    let count = 0;
    if (actionType === 'submission') count = user.stats?.roomsAdded || 0;
    if (actionType === 'review') count = user.stats?.reviewsWritten || 0;

    // Special case for points
    if (badge.threshold === 1000 && user.points >= 1000) {
        newBadges.push(badge);
    } else if (count >= badge.threshold && badge.threshold !== 1000) {
        newBadges.push(badge);
    }
  });

  return newBadges;
};

export const addPoints = (user: User, points: number, actionType: 'ROOM' | 'REVIEW'): { user: User, newBadges: Badge[] } => {
  const newPoints = user.points + points;
  const newStats = { ...user.stats! }; // Using ! asserting stats exists for now, should handle init
  
  if (actionType === 'ROOM') newStats.roomsAdded = (newStats.roomsAdded || 0) + 1;
  if (actionType === 'REVIEW') newStats.reviewsWritten = (newStats.reviewsWritten || 0) + 1;

  const updatedUser: User = {
    ...user,
    points: newPoints,
    level: calculateLevel(newPoints),
    stats: newStats
  };

  const earnedBadges = checkBadges(updatedUser, actionType === 'ROOM' ? 'submission' : 'review');
  if (earnedBadges.length > 0) {
    updatedUser.badges = [...(updatedUser.badges || []), ...earnedBadges.map(b => b.id)];
  }

  return { user: updatedUser, newBadges: earnedBadges };
};
