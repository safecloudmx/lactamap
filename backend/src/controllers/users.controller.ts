import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import sharp from 'sharp';
import { uploadToS3, signUrl } from '../lib/s3';

export const usersController = {
  getProfile: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          badges: { include: { badge: true } },
          _count: { select: { reviews: true, ownedLactarios: true } },
        },
      });

      if (!user) return res.status(404).json({ error: 'User not found' });

      res.json({
        id: user.id,
        email: user.email,
        name: user.name ?? user.email.split('@')[0],
        role: user.role,
        points: user.points,
        level: Math.floor(user.points / 100) + 1,
        avatarUrl: await signUrl(user.avatarUrl),
        badges: user.badges.map((ub) => ub.badge),
        stats: {
          reviewsWritten: user._count.reviews,
          roomsAdded: user._count.ownedLactarios,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching profile' });
    }
  },

  updateProfile: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Name must be at least 2 characters' });
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { name: name.trim() },
        select: { id: true, email: true, name: true, role: true, points: true, avatarUrl: true },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Error updating profile' });
    }
  },

  uploadAvatar: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!req.file) return res.status(400).json({ error: 'No file provided' });

      const webpBuffer = await sharp(req.file.buffer)
        .rotate() // auto-rotate based on EXIF orientation
        .resize(400, 400, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();

      const key = `profiles/${userId}_${Date.now()}.webp`;
      const storedUrl = await uploadToS3(webpBuffer, key);

      await prisma.user.update({ where: { id: userId }, data: { avatarUrl: storedUrl } });

      const avatarUrl = await signUrl(storedUrl);
      res.json({ avatarUrl });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error uploading avatar' });
    }
  },

  getLeaderboard: async (req: Request, res: Response) => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { points: 'desc' },
        take: 20,
        select: { id: true, email: true, name: true, points: true, role: true, avatarUrl: true },
      });

      const result = await Promise.all(users.map(async (u, index) => ({
        rank: index + 1,
        id: u.id,
        name: u.name ?? u.email.split('@')[0],
        points: u.points,
        role: u.role,
        avatarUrl: await signUrl(u.avatarUrl),
      })));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error fetching leaderboard' });
    }
  },
};
