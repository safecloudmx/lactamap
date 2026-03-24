import { Response } from 'express';
import prisma from '../lib/prisma';
import sharp from 'sharp';
import { uploadToS3, deleteFromS3, keyFromUrl, signUrl } from '../lib/s3';
import { AuthRequest } from '../middleware/auth.middleware';

export const pumpingSessionsController = {
  // GET /api/v1/pumping-sessions?date=YYYY-MM-DD&babyId=xxx
  getAll: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { date, babyId } = req.query;

      const where: any = { userId };
      if (date) {
        const day = new Date(date as string);
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        where.pumpedAt = { gte: day, lt: next };
      }
      if (babyId) where.babyId = babyId as string;

      const sessions = await prisma.pumpingSession.findMany({
        where,
        orderBy: { pumpedAt: 'desc' },
        include: {
          photos: true,
          baby: { select: { id: true, name: true } },
        },
      });

      // Sign photo URLs
      const result = await Promise.all(
        sessions.map(async (s) => ({
          ...s,
          amountMl: Number(s.amountMl),
          photos: await Promise.all(
            s.photos.map(async (p) => ({
              ...p,
              url: (await signUrl(p.url)) || p.url,
            })),
          ),
        })),
      );

      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching pumping sessions' });
    }
  },

  // GET /api/v1/pumping-sessions/:id
  getOne: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const session = await prisma.pumpingSession.findUnique({
        where: { id },
        include: { photos: true },
      });

      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const photos = await Promise.all(
        session.photos.map(async (p) => ({
          ...p,
          url: (await signUrl(p.url)) || p.url,
        })),
      );

      res.json({ ...session, amountMl: Number(session.amountMl), photos });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching pumping session' });
    }
  },

  // POST /api/v1/pumping-sessions
  create: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { side, pumpedAt, amountMl, notes, babyId } = req.body;

      if (!side || !pumpedAt) {
        return res.status(400).json({ error: 'side and pumpedAt are required' });
      }
      if (!['LEFT', 'RIGHT', 'BOTH'].includes(side)) {
        return res.status(400).json({ error: 'side must be LEFT, RIGHT, or BOTH' });
      }

      // Verify baby belongs to user if provided
      if (babyId) {
        const baby = await prisma.baby.findUnique({ where: { id: babyId } });
        if (!baby || baby.userId !== userId) {
          return res.status(403).json({ error: 'Invalid babyId' });
        }
      }

      const session = await prisma.pumpingSession.create({
        data: {
          userId,
          side,
          pumpedAt: new Date(pumpedAt),
          amountMl: amountMl ?? 0,
          notes: notes?.trim() || null,
          babyId: babyId || null,
        },
        include: { photos: true },
      });

      res.status(201).json({ ...session, amountMl: Number(session.amountMl) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error creating pumping session' });
    }
  },

  // PUT /api/v1/pumping-sessions/:id
  update: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const { side, pumpedAt, amountMl, notes, babyId } = req.body;

      const existing = await prisma.pumpingSession.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Session not found' });
      if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      if (side && !['LEFT', 'RIGHT', 'BOTH'].includes(side)) {
        return res.status(400).json({ error: 'side must be LEFT, RIGHT, or BOTH' });
      }

      const session = await prisma.pumpingSession.update({
        where: { id },
        data: {
          ...(side && { side }),
          ...(pumpedAt && { pumpedAt: new Date(pumpedAt) }),
          ...(amountMl !== undefined && { amountMl }),
          ...(notes !== undefined && { notes: notes?.trim() || null }),
          ...(babyId !== undefined && { babyId: babyId || null }),
        },
        include: { photos: true },
      });

      const photos = await Promise.all(
        session.photos.map(async (p) => ({
          ...p,
          url: (await signUrl(p.url)) || p.url,
        })),
      );

      res.json({ ...session, amountMl: Number(session.amountMl), photos });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error updating pumping session' });
    }
  },

  // DELETE /api/v1/pumping-sessions/:id
  delete: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const existing = await prisma.pumpingSession.findUnique({
        where: { id },
        include: { photos: true },
      });
      if (!existing) return res.status(404).json({ error: 'Session not found' });
      if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      // Delete photos from S3
      for (const photo of existing.photos) {
        const s3Key = keyFromUrl(photo.url);
        if (s3Key) {
          try { await deleteFromS3(s3Key); } catch { /* ignore */ }
        }
      }

      await prisma.pumpingSession.delete({ where: { id } });
      res.json({ message: 'Session deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error deleting pumping session' });
    }
  },

  // POST /api/v1/pumping-sessions/:id/photos
  uploadPhoto: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!req.file) return res.status(400).json({ error: 'No file provided' });

      const session = await prisma.pumpingSession.findUnique({ where: { id } });
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const photoCount = await prisma.pumpingPhoto.count({ where: { pumpingSessionId: id } });
      if (photoCount >= 5) return res.status(400).json({ error: 'Máximo 5 fotos por sesión' });

      const webpBuffer = await sharp(req.file.buffer)
        .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const key = `pumping/${id}_${Date.now()}.webp`;
      const url = await uploadToS3(webpBuffer, key);

      const photo = await prisma.pumpingPhoto.create({
        data: { pumpingSessionId: id, url },
      });

      const signedUrl = await signUrl(url);
      res.status(201).json({ ...photo, url: signedUrl || url });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error uploading photo' });
    }
  },

  // DELETE /api/v1/pumping-sessions/:sessionId/photos/:photoId
  deletePhoto: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { photoId } = req.params;

      const photo = await prisma.pumpingPhoto.findUnique({
        where: { id: photoId },
        include: { pumpingSession: { select: { userId: true } } },
      });
      if (!photo) return res.status(404).json({ error: 'Photo not found' });
      if (photo.pumpingSession.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const s3Key = keyFromUrl(photo.url);
      if (s3Key) {
        try { await deleteFromS3(s3Key); } catch { /* ignore */ }
      }

      await prisma.pumpingPhoto.delete({ where: { id: photoId } });
      res.json({ message: 'Photo deleted' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error deleting photo' });
    }
  },
};
