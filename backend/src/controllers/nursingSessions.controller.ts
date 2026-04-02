import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { getAccessibleBabyIds, hasAccessToBaby } from '../lib/partnerships';

export const nursingSessionsController = {
  // GET /api/v1/nursing-sessions?babyId=&date=
  getAll: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { babyId, date } = req.query;

      const sharedIds = await getAccessibleBabyIds(userId!);
      const base = sharedIds.length > 0
        ? { OR: [{ userId }, { babyId: { in: sharedIds } }] }
        : { userId };
      const where: any = babyId
        ? { babyId: babyId as string }
        : base;
      if (date) {
        const day = new Date(date as string);
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        where.startedAt = { gte: day, lt: next };
      }

      const sessions = await prisma.nursingSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        include: {
          baby: { select: { id: true, name: true } },
        },
      });

      res.json(sessions);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching nursing sessions' });
    }
  },

  // POST /api/v1/nursing-sessions
  create: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const {
        babyId, startedAt, endedAt,
        leftDuration, rightDuration, totalDuration,
        totalPauseTime, lastSide, notes,
      } = req.body;

      if (!startedAt || !endedAt || totalDuration == null) {
        return res.status(400).json({ error: 'startedAt, endedAt, and totalDuration are required' });
      }

      // Verify user has access to the baby (owns it or has BabyAccess)
      if (babyId) {
        const ok = await hasAccessToBaby(userId!, babyId);
        if (!ok) return res.status(403).json({ error: 'Invalid babyId' });
      }

      const session = await prisma.nursingSession.create({
        data: {
          userId,
          babyId: babyId || null,
          startedAt: new Date(startedAt),
          endedAt: new Date(endedAt),
          leftDuration: leftDuration ?? 0,
          rightDuration: rightDuration ?? 0,
          totalDuration,
          totalPauseTime: totalPauseTime ?? 0,
          lastSide: lastSide ?? 'both',
          notes: notes?.trim() || null,
        },
        include: {
          baby: { select: { id: true, name: true } },
        },
      });

      res.status(201).json(session);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error creating nursing session' });
    }
  },

  // DELETE /api/v1/nursing-sessions/:id
  delete: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const existing = await prisma.nursingSession.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Session not found' });
      if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      await prisma.nursingSession.delete({ where: { id } });
      res.json({ message: 'Session deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error deleting nursing session' });
    }
  },
};
