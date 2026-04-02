import { Response } from 'express';
import sharp from 'sharp';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { uploadToS3, signUrl, keyFromUrl, deleteFromS3 } from '../lib/s3';
import { getAccessibleBabyIds, hasAccessToBaby } from '../lib/partnerships';

const BABY_SELECT = {
  id: true,
  name: true,
  birthDate: true,
  avatarUrl: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
};

async function signBaby(baby: any) {
  return {
    ...baby,
    avatarUrl: baby.avatarUrl ? await signUrl(baby.avatarUrl) : null,
  };
}

export const babiesController = {
  // GET /api/v1/babies
  getAll: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId!;
      const sharedIds = await getAccessibleBabyIds(userId);
      const babies = await prisma.baby.findMany({
        where: sharedIds.length > 0
          ? { OR: [{ userId }, { id: { in: sharedIds } }] }
          : { userId },
        orderBy: { createdAt: 'asc' },
        select: BABY_SELECT,
      });
      const signed = await Promise.all(babies.map(signBaby));
      res.json(signed);
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
        select: BABY_SELECT,
      });

      res.status(201).json(await signBaby(baby));
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
        select: BABY_SELECT,
      });

      res.json(await signBaby(baby));
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

      // Delete associated records first
      await prisma.growthRecord.deleteMany({ where: { babyId: id } });
      await prisma.diaperRecord.deleteMany({ where: { babyId: id } });
      await prisma.sleepSession.deleteMany({ where: { babyId: id } });
      await prisma.pumpingSession.deleteMany({ where: { babyId: id } });
      await prisma.nursingSession.deleteMany({ where: { babyId: id } });

      // Delete avatar from S3 if exists
      if (existing.avatarUrl) {
        const key = keyFromUrl(existing.avatarUrl);
        if (key) try { await deleteFromS3(key); } catch {}
      }

      await prisma.baby.delete({ where: { id } });
      res.json({ message: 'Baby deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error deleting baby' });
    }
  },

  // POST /api/v1/babies/:id/avatar
  uploadAvatar: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!req.file) return res.status(400).json({ error: 'No file provided' });

      const existing = await prisma.baby.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Baby not found' });
      if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      // Process image: square crop, resize, convert to WebP
      const webpBuffer = await sharp(req.file.buffer)
        .rotate()
        .resize(400, 400, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();

      const key = `babies/${id}_${Date.now()}.webp`;
      const url = await uploadToS3(webpBuffer, key);

      // Delete old avatar if exists
      if (existing.avatarUrl) {
        const oldKey = keyFromUrl(existing.avatarUrl);
        if (oldKey) try { await deleteFromS3(oldKey); } catch {}
      }

      const baby = await prisma.baby.update({
        where: { id },
        data: { avatarUrl: url },
        select: BABY_SELECT,
      });

      res.json(await signBaby(baby));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error uploading avatar' });
    }
  },
};
