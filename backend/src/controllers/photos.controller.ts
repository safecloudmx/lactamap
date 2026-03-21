import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import sharp from 'sharp';
import { uploadToS3, deleteFromS3, keyFromUrl } from '../lib/s3';

export const photosController = {
  upload: async (req: Request, res: Response) => {
    try {
      const { lactarioId } = req.params;
      const userId = (req as any).user?.userId;

      if (!req.file) return res.status(400).json({ error: 'No file provided' });

      const lactario = await prisma.lactario.findUnique({ where: { id: lactarioId } });
      if (!lactario) return res.status(404).json({ error: 'Lactario not found' });

      const photoCount = await prisma.photo.count({ where: { lactarioId } });
      if (photoCount >= 5) return res.status(400).json({ error: 'Máximo 5 fotos por lugar' });

      // Resize and convert to WebP
      const webpBuffer = await sharp(req.file.buffer)
        .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const folder = lactario.placeType === 'CAMBIADOR' ? 'cambiadores' : 'lactarios';
      const key = `${folder}/${lactarioId}_${Date.now()}.webp`;
      const url = await uploadToS3(webpBuffer, key);

      const photo = await prisma.photo.create({
        data: { lactarioId, url, moderationStatus: 'APPROVED' },
      });

      // Set imageUrl on Lactario if it's the first photo
      if (!lactario.imageUrl) {
        await prisma.lactario.update({ where: { id: lactarioId }, data: { imageUrl: url } });
      }

      res.status(201).json(photo);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error uploading photo' });
    }
  },

  deletePhoto: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const userRole = (req as any).user?.role;

      const photo = await prisma.photo.findUnique({
        where: { id },
        include: { lactario: { select: { ownerId: true, imageUrl: true } } },
      });
      if (!photo) return res.status(404).json({ error: 'Photo not found' });

      const isOwner = photo.lactario.ownerId === userId;
      const isPrivileged = ['ADMIN', 'ELITE'].includes(userRole);
      if (!isOwner && !isPrivileged) return res.status(403).json({ error: 'Access denied' });

      // Delete from S3
      const s3Key = keyFromUrl(photo.url);
      if (s3Key) {
        try { await deleteFromS3(s3Key); } catch { /* ignore if already gone */ }
      }

      await prisma.photo.delete({ where: { id } });

      // If this was the cover image, update imageUrl to next available photo
      if (photo.lactario.imageUrl === photo.url) {
        const next = await prisma.photo.findFirst({
          where: { lactarioId: photo.lactarioId, moderationStatus: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
        });
        await prisma.lactario.update({
          where: { id: photo.lactarioId },
          data: { imageUrl: next?.url ?? null },
        });
      }

      res.json({ message: 'Photo deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Error deleting photo' });
    }
  },
};
