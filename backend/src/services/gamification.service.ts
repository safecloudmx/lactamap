import { User } from '@prisma/client';
import prisma from '../lib/prisma';

const BADGES = {
  FIRST_REVIEW: { code: 'FIRST_REVIEW' },
  EXPLORER: { code: 'EXPLORER' },      // 5 photos uploaded
  CONTRIBUTOR: { code: 'CONTRIBUTOR' }, // 3 lactarios submitted
  SUPER_MOM: { code: 'SUPER_MOM' },    // 100+ points
};

export const GamificationService = {
  async addPoints(userId: string, points: number, reason: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { points: { increment: points } },
    });

    console.log(`[Gamification] +${points} to ${userId} for ${reason}. Total: ${user.points}`);

    await this.checkBadges(user);

    return user;
  },

  async checkBadges(user: User) {
    const badgesToAdd: string[] = [];

    if (user.points >= 100) {
      badgesToAdd.push(BADGES.SUPER_MOM.code);
    }

    const reviewCount = await prisma.review.count({ where: { userId: user.id } });
    const roomCount = await prisma.lactario.count({ where: { ownerId: user.id } });
    // Note: Photo model does not have uploadedById yet; EXPLORER badge pending schema update

    if (reviewCount >= 1) badgesToAdd.push(BADGES.FIRST_REVIEW.code);
    if (roomCount >= 3) badgesToAdd.push(BADGES.CONTRIBUTOR.code);

    for (const code of badgesToAdd) {
      await this.awardBadge(user.id, code);
    }
  },

  async awardBadge(userId: string, badgeCode: string) {
    const badge = await prisma.badge.findUnique({ where: { code: badgeCode } });
    if (!badge) return;

    const existing = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
    });

    if (!existing) {
      await prisma.userBadge.create({
        data: { userId, badgeId: badge.id },
      });
      console.log(`[Gamification] Badge "${badge.name}" awarded to ${userId}`);
    }
  },
};
