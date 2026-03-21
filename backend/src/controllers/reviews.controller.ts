import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { GamificationService } from '../services/gamification.service';
import { signUrl } from '../lib/s3';

const REVIEWER_ROLES = ['ADMIN', 'ELITE'];
const AUTO_HIDE_THRESHOLD = 10;

export const reviewsController = {
  create: async (req: Request, res: Response) => {
    try {
      const { lactarioId } = req.params;
      const { rating, comment } = req.body;
      const userId = (req as any).user?.userId;

      const ratingNum = Number(rating);
      if (!ratingNum || ratingNum < 1 || ratingNum > 5 || !Number.isInteger(ratingNum)) {
        return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
      }

      const lactario = await prisma.lactario.findUnique({ where: { id: lactarioId } });
      if (!lactario) return res.status(404).json({ error: 'Lactario not found' });

      const existing = await prisma.review.findUnique({
        where: { userId_lactarioId: { userId, lactarioId } },
      });
      if (existing) return res.status(409).json({ error: 'Ya dejaste una reseña en este lugar' });

      const review = await prisma.review.create({
        data: { lactarioId, userId, rating: ratingNum, comment },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      });
      const signedReview = { ...review, user: { ...review.user, avatarUrl: await signUrl(review.user.avatarUrl) } };

      const agg = await prisma.review.aggregate({
        where: { lactarioId },
        _avg: { rating: true },
      });
      await prisma.lactario.update({
        where: { id: lactarioId },
        data: { avgRating: agg._avg.rating ?? 0 },
      });

      await GamificationService.addPoints(userId, 5, 'REVIEW_ADDED');
      res.status(201).json(signedReview);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error creating review' });
    }
  },

  getByLactario: async (req: Request, res: Response) => {
    try {
      const { lactarioId } = req.params;
      const userRole = (req as any).user?.role;
      const isReviewer = REVIEWER_ROLES.includes(userRole);

      const reviews = await prisma.review.findMany({
        where: { lactarioId, ...(!isReviewer && { isHidden: false }) },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      });
      const signed = await Promise.all(reviews.map(async (r) => ({
        ...r,
        user: { ...r.user, avatarUrl: await signUrl(r.user.avatarUrl) },
      })));
      res.json(signed);
    } catch (error) {
      res.status(500).json({ error: 'Error fetching reviews' });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const { rating, comment } = req.body;

      const review = await prisma.review.findUnique({ where: { id } });
      if (!review) return res.status(404).json({ error: 'Review not found' });
      if (review.userId !== userId) return res.status(403).json({ error: 'Only the author can edit this review' });

      const ratingNum = Number(rating);
      if (!ratingNum || ratingNum < 1 || ratingNum > 5 || !Number.isInteger(ratingNum)) {
        return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
      }

      const updated = await prisma.review.update({
        where: { id },
        data: { rating: ratingNum, comment },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      });
      const signedUpdated = { ...updated, user: { ...updated.user, avatarUrl: await signUrl(updated.user.avatarUrl) } };

      // Recalculate average
      const agg = await prisma.review.aggregate({
        where: { lactarioId: review.lactarioId },
        _avg: { rating: true },
      });
      await prisma.lactario.update({
        where: { id: review.lactarioId },
        data: { avgRating: agg._avg.rating ?? 0 },
      });

      res.json(signedUpdated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error updating review' });
    }
  },

  remove: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const userRole = (req as any).user?.role;

      const review = await prisma.review.findUnique({ where: { id } });
      if (!review) return res.status(404).json({ error: 'Review not found' });

      const isOwner = review.userId === userId;
      const isReviewer = REVIEWER_ROLES.includes(userRole);
      if (!isOwner && !isReviewer) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await prisma.review.delete({ where: { id } });

      // Recalculate average
      const agg = await prisma.review.aggregate({
        where: { lactarioId: review.lactarioId },
        _avg: { rating: true },
      });
      await prisma.lactario.update({
        where: { id: review.lactarioId },
        data: { avgRating: agg._avg.rating ?? 0 },
      });

      res.json({ message: 'Review deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Error deleting review' });
    }
  },

  report: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const { reason } = req.body;

      const review = await prisma.review.findUnique({ where: { id } });
      if (!review) return res.status(404).json({ error: 'Review not found' });
      if (review.userId === userId) return res.status(400).json({ error: 'No puedes reportar tu propia reseña' });

      // Prevent duplicate report
      const existing = await prisma.reviewReport.findUnique({
        where: { reviewId_userId: { reviewId: id, userId } },
      });
      if (existing) return res.status(400).json({ error: 'Ya reportaste esta reseña' });

      await prisma.$transaction(async (tx) => {
        await tx.reviewReport.create({ data: { reviewId: id, userId, reason: reason || null } });
        const newCount = review.reportCount + 1;
        await tx.review.update({
          where: { id },
          data: {
            reportCount: newCount,
            ...(newCount >= AUTO_HIDE_THRESHOLD && { isHidden: true }),
          },
        });
      });

      res.json({ message: 'Reseña reportada' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error reporting review' });
    }
  },

  getReported: async (req: Request, res: Response) => {
    try {
      const userRole = (req as any).user?.role;
      if (!REVIEWER_ROLES.includes(userRole)) return res.status(403).json({ error: 'Access denied' });

      const reviews = await prisma.review.findMany({
        where: { isHidden: true },
        include: {
          user: { select: { id: true, email: true, name: true } },
          lactario: { select: { id: true, name: true } },
          reports: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: { reportCount: 'desc' },
      });
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: 'Error fetching reported reviews' });
    }
  },

  unhide: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userRole = (req as any).user?.role;
      if (!REVIEWER_ROLES.includes(userRole)) return res.status(403).json({ error: 'Access denied' });

      const review = await prisma.review.findUnique({ where: { id } });
      if (!review) return res.status(404).json({ error: 'Review not found' });

      // Unhide and clear reports
      await prisma.$transaction([
        prisma.reviewReport.deleteMany({ where: { reviewId: id } }),
        prisma.review.update({ where: { id }, data: { isHidden: false, reportCount: 0 } }),
      ]);

      res.json({ message: 'Reseña restaurada' });
    } catch (error) {
      res.status(500).json({ error: 'Error unhiding review' });
    }
  },
};
