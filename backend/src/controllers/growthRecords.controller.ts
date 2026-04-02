import { Response } from 'express';
import prisma from '../lib/prisma';
import sharp from 'sharp';
import { uploadToS3, deleteFromS3, keyFromUrl, signUrl } from '../lib/s3';
import { AuthRequest } from '../middleware/auth.middleware';
import { hasAccessToBaby } from '../lib/partnerships';

const formatRecord = async (r: any) => ({
  ...r,
  weightKg: r.weightKg ? Number(r.weightKg) : null,
  heightCm: r.heightCm ? Number(r.heightCm) : null,
  headCircumferenceCm: r.headCircumferenceCm ? Number(r.headCircumferenceCm) : null,
  photos: r.photos
    ? await Promise.all(
        r.photos.map(async (p: any) => ({
          ...p,
          url: (await signUrl(p.url)) || p.url,
        }))
      )
    : [],
});

export const growthRecordsController = {
  // GET /api/v1/growth-records?babyId=
  getAll: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { babyId } = req.query;

      if (!babyId) {
        return res.status(400).json({ error: 'babyId is required' });
      }

      const ok = await hasAccessToBaby(userId!, babyId as string);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });

      const records = await prisma.growthRecord.findMany({
        where: { babyId: babyId as string },
        orderBy: { measuredAt: 'desc' },
        include: { photos: true },
      });

      const result = await Promise.all(records.map(formatRecord));
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching growth records' });
    }
  },

  // POST /api/v1/growth-records
  create: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { babyId, measuredAt, weightKg, heightCm, headCircumferenceCm, notes } = req.body;

      if (!babyId || !measuredAt) {
        return res.status(400).json({ error: 'babyId and measuredAt are required' });
      }

      const ok = await hasAccessToBaby(userId!, babyId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });

      const record = await prisma.growthRecord.create({
        data: {
          userId,
          babyId,
          measuredAt: new Date(measuredAt),
          weightKg: weightKg ?? null,
          heightCm: heightCm ?? null,
          headCircumferenceCm: headCircumferenceCm ?? null,
          notes: notes?.trim() || null,
        },
        include: { photos: true },
      });

      res.status(201).json(await formatRecord(record));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error creating growth record' });
    }
  },

  // PUT /api/v1/growth-records/:id
  update: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const { measuredAt, weightKg, heightCm, headCircumferenceCm, notes } = req.body;

      const existing = await prisma.growthRecord.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Record not found' });
      if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const record = await prisma.growthRecord.update({
        where: { id },
        data: {
          ...(measuredAt !== undefined && { measuredAt: new Date(measuredAt) }),
          ...(weightKg !== undefined && { weightKg: weightKg ?? null }),
          ...(heightCm !== undefined && { heightCm: heightCm ?? null }),
          ...(headCircumferenceCm !== undefined && { headCircumferenceCm: headCircumferenceCm ?? null }),
          ...(notes !== undefined && { notes: notes?.trim() || null }),
        },
        include: { photos: true },
      });

      res.json(await formatRecord(record));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error updating growth record' });
    }
  },

  // DELETE /api/v1/growth-records/:id
  delete: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const existing = await prisma.growthRecord.findUnique({
        where: { id },
        include: { photos: true },
      });
      if (!existing) return res.status(404).json({ error: 'Record not found' });
      if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      // Delete photos from S3
      for (const photo of existing.photos) {
        const s3Key = keyFromUrl(photo.url);
        if (s3Key) {
          try { await deleteFromS3(s3Key); } catch { /* ignore */ }
        }
      }

      await prisma.growthRecord.delete({ where: { id } });
      res.json({ message: 'Growth record deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error deleting growth record' });
    }
  },

  // POST /api/v1/growth-records/:id/photos
  uploadPhoto: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!req.file) return res.status(400).json({ error: 'No file provided' });

      const record = await prisma.growthRecord.findUnique({ where: { id } });
      if (!record) return res.status(404).json({ error: 'Record not found' });
      if (record.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const photoCount = await prisma.growthPhoto.count({ where: { growthRecordId: id } });
      if (photoCount >= 5) return res.status(400).json({ error: 'Máximo 5 fotos por registro' });

      const webpBuffer = await sharp(req.file.buffer)
        .rotate()
        .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const key = `growth/${id}_${Date.now()}.webp`;
      const url = await uploadToS3(webpBuffer, key);

      const photo = await prisma.growthPhoto.create({
        data: { growthRecordId: id, url },
      });

      const signedUrl = await signUrl(url);
      res.status(201).json({ ...photo, url: signedUrl || url });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error uploading photo' });
    }
  },

  // DELETE /api/v1/growth-records/:recordId/photos/:photoId
  deletePhoto: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { photoId } = req.params;

      const photo = await prisma.growthPhoto.findUnique({
        where: { id: photoId },
        include: { growthRecord: { select: { userId: true } } },
      });
      if (!photo) return res.status(404).json({ error: 'Photo not found' });
      if (photo.growthRecord.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const s3Key = keyFromUrl(photo.url);
      if (s3Key) {
        try { await deleteFromS3(s3Key); } catch { /* ignore */ }
      }

      await prisma.growthPhoto.delete({ where: { id: photoId } });
      res.json({ message: 'Photo deleted' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error deleting photo' });
    }
  },
};
