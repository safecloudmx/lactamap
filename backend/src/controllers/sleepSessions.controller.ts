import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { getAccessibleBabyIds, hasAccessToBaby } from '../lib/partnerships';

export const sleepSessionsController = {
  // GET /api/v1/sleep-sessions?babyId=&date=
  getAll: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { babyId, date } = req.query;

      const sharedIds = await getAccessibleBabyIds(userId!);
      const base = sharedIds.length > 0
        ? { OR: [{ userId }, { babyId: { in: sharedIds } }] }
        : { userId };
      const where: any = babyId ? { babyId } : base;
      if (date) {
        const dayStart = new Date(date as string);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        where.startedAt = { gte: dayStart, lt: dayEnd };
      }

      const sessions = await prisma.sleepSession.findMany({
        where,
        include: { baby: { select: { id: true, name: true } } },
        orderBy: { startedAt: 'desc' },
      });

      res.json(sessions);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching sleep sessions' });
    }
  },

  // GET /api/v1/sleep-sessions/:id
  getOne: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const session = await prisma.sleepSession.findUnique({
        where: { id },
        include: { baby: { select: { id: true, name: true } } },
      });
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      res.json(session);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching sleep session' });
    }
  },

  // POST /api/v1/sleep-sessions
  create: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { babyId, startedAt, endedAt, totalDuration, totalPauseTime, notes } = req.body;

      if (!startedAt || !endedAt || totalDuration === undefined) {
        return res.status(400).json({ error: 'startedAt, endedAt, and totalDuration are required' });
      }

      if (babyId) {
        const ok = await hasAccessToBaby(userId!, babyId);
        if (!ok) return res.status(403).json({ error: 'Baby not found or access denied' });
      }

      const session = await prisma.sleepSession.create({
        data: {
          userId,
          babyId: babyId || null,
          startedAt: new Date(startedAt),
          endedAt: new Date(endedAt),
          totalDuration,
          totalPauseTime: totalPauseTime || 0,
          notes: notes?.trim() || null,
        },
        include: { baby: { select: { id: true, name: true } } },
      });

      res.status(201).json(session);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error creating sleep session' });
    }
  },

  // PUT /api/v1/sleep-sessions/:id
  update: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const { babyId, startedAt, endedAt, totalDuration, totalPauseTime, notes } = req.body;

      const existing = await prisma.sleepSession.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Session not found' });
      if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const session = await prisma.sleepSession.update({
        where: { id },
        data: {
          ...(babyId !== undefined && { babyId: babyId || null }),
          ...(startedAt !== undefined && { startedAt: new Date(startedAt) }),
          ...(endedAt !== undefined && { endedAt: new Date(endedAt) }),
          ...(totalDuration !== undefined && { totalDuration }),
          ...(totalPauseTime !== undefined && { totalPauseTime }),
          ...(notes !== undefined && { notes: notes?.trim() || null }),
        },
        include: { baby: { select: { id: true, name: true } } },
      });

      res.json(session);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error updating sleep session' });
    }
  },

  // DELETE /api/v1/sleep-sessions/:id
  delete: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const existing = await prisma.sleepSession.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Session not found' });
      if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      await prisma.sleepSession.delete({ where: { id } });
      res.json({ message: 'Sleep session deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error deleting sleep session' });
    }
  },
};
