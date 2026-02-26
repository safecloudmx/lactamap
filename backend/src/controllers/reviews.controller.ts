import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { GamificationService } from '../services/gamification.service';

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

      const review = await prisma.review.create({
        data: {
          lactarioId,
          userId,
          rating: ratingNum,
          comment,
        },
        include: { user: { select: { id: true, email: true, name: true } } },
      });

      // Recalculate average rating
      const agg = await prisma.review.aggregate({
        where: { lactarioId },
        _avg: { rating: true },
      });
      await prisma.lactario.update({
        where: { id: lactarioId },
        data: { avgRating: agg._avg.rating ?? 0 },
      });

      await GamificationService.addPoints(userId, 5, 'REVIEW_ADDED');

      res.status(201).json(review);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error creating review' });
    }
  },

  getByLactario: async (req: Request, res: Response) => {
    try {
      const { lactarioId } = req.params;
      const reviews = await prisma.review.findMany({
        where: { lactarioId },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: 'Error fetching reviews' });
    }
  },

  remove: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const userRole = (req as any).user?.role;

      const review = await prisma.review.findUnique({ where: { id } });
      if (!review) return res.status(404).json({ error: 'Review not found' });

      if (review.userId !== userId && userRole !== 'ADMIN') {
        return res.status(403).json({ error: 'Access denied' });
      }

      await prisma.review.delete({ where: { id } });
      res.json({ message: 'Review deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Error deleting review' });
    }
  },
};
