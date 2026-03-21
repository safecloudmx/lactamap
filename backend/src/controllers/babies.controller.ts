import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const babiesController = {
  // GET /api/v1/babies
  getAll: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const babies = await prisma.baby.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          birthDate: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      res.json(babies);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching babies' });
    }
  },

  // POST /api/v1/babies
  create: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { name, birthDate, notes } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Name must be at least 2 characters' });
      }

      const baby = await prisma.baby.create({
        data: {
          userId,
          name: name.trim(),
          birthDate: birthDate ? new Date(birthDate) : null,
          notes: notes?.trim() || null,
        },
        select: {
          id: true,
          name: true,
          birthDate: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.status(201).json(baby);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error creating baby' });
    }
  },

  // PUT /api/v1/babies/:id
  update: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const { name, birthDate, notes } = req.body;

      const existing = await prisma.baby.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Baby not found' });
      if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
        return res.status(400).json({ error: 'Name must be at least 2 characters' });
      }

      const baby = await prisma.baby.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(birthDate !== undefined && { birthDate: birthDate ? new Date(birthDate) : null }),
          ...(notes !== undefined && { notes: notes?.trim() || null }),
        },
        select: {
          id: true,
          name: true,
          birthDate: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json(baby);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error updating baby' });
    }
  },

  // DELETE /api/v1/babies/:id
  delete: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const existing = await prisma.baby.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Baby not found' });
      if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      // Delete associated nursing sessions first
      await prisma.nursingSession.deleteMany({ where: { babyId: id } });
      await prisma.baby.delete({ where: { id } });

      res.json({ message: 'Baby deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error deleting baby' });
    }
  },
};
