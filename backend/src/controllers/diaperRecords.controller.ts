import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { getAccessibleBabyIds, hasAccessToBaby } from '../lib/partnerships';

const VALID_TYPES = ['wet', 'dirty', 'both'];

export const diaperRecordsController = {
  // GET /api/v1/diaper-records?babyId=&date=
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
        where.changedAt = { gte: dayStart, lt: dayEnd };
      }

      const records = await prisma.diaperRecord.findMany({
        where,
        include: { baby: { select: { id: true, name: true } } },
        orderBy: { changedAt: 'desc' },
      });

      res.json(records);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching diaper records' });
    }
  },

  // GET /api/v1/diaper-records/:id
  getOne: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const record = await prisma.diaperRecord.findUnique({
        where: { id },
        include: { baby: { select: { id: true, name: true } } },
      });
      if (!record) return res.status(404).json({ error: 'Record not found' });
      if (record.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      res.json(record);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching diaper record' });
    }
  },

  // POST /api/v1/diaper-records
  create: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { babyId, type, changedAt, notes } = req.body;

      if (!type || !VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: 'type must be one of: wet, dirty, both' });
      }
      if (!changedAt) {
        return res.status(400).json({ error: 'changedAt is required' });
      }

      if (babyId) {
        const ok = await hasAccessToBaby(userId!, babyId);
        if (!ok) return res.status(403).json({ error: 'Baby not found or access denied' });
      }

      const record = await prisma.diaperRecord.create({
        data: {
          userId,
          babyId: babyId || null,
          type,
          changedAt: new Date(changedAt),
          notes: notes?.trim() || null,
        },
        include: { baby: { select: { id: true, name: true } } },
      });

      res.status(201).json(record);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error creating diaper record' });
    }
  },

  // PUT /api/v1/diaper-records/:id
  update: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const { babyId, type, changedAt, notes } = req.body;

      const existing = await prisma.diaperRecord.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Record not found' });
      if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      if (type !== undefined && !VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: 'type must be one of: wet, dirty, both' });
      }

      const record = await prisma.diaperRecord.update({
        where: { id },
        data: {
          ...(babyId !== undefined && { babyId: babyId || null }),
          ...(type !== undefined && { type }),
          ...(changedAt !== undefined && { changedAt: new Date(changedAt) }),
          ...(notes !== undefined && { notes: notes?.trim() || null }),
        },
        include: { baby: { select: { id: true, name: true } } },
      });

      res.json(record);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error updating diaper record' });
    }
  },

  // DELETE /api/v1/diaper-records/:id
  delete: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const existing = await prisma.diaperRecord.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Record not found' });
      if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      await prisma.diaperRecord.delete({ where: { id } });
      res.json({ message: 'Diaper record deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error deleting diaper record' });
    }
  },
};
