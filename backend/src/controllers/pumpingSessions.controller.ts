import { Response } from 'express';
import prisma from '../lib/prisma';
import sharp from 'sharp';
import { uploadToS3, deleteFromS3, keyFromUrl, signUrl } from '../lib/s3';
import { AuthRequest } from '../middleware/auth.middleware';
import { generateUniqueFolio, buildFolio } from '../lib/folio';
import { calculateExpiration } from '../lib/expiration';

const VALID_SIDES = ['LEFT', 'RIGHT', 'BOTH'];
const VALID_STORAGE = ['FROZEN', 'REFRIGERATED', 'CONSUMED'];
const VALID_CLASSIFICATION = ['DAY', 'NIGHT'];

// Allowed status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  FROZEN: ['REFRIGERATED', 'CONSUMED'],
  REFRIGERATED: ['CONSUMED'],
  CONSUMED: [],
};

const CONSUMED_LOCK_MS = 15 * 60 * 1000; // 15 minutes

const sessionInclude = {
  photos: true,
  baby: { select: { id: true, name: true } },
  statusHistory: { orderBy: { changedAt: 'desc' as const } },
};

async function signPhotos(photos: any[]) {
  return Promise.all(
    photos.map(async (p: any) => ({
      ...p,
      url: (await signUrl(p.url)) || p.url,
    })),
  );
}

function formatSession(s: any) {
  return {
    ...s,
    amountMl: Number(s.amountMl),
  };
}

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
        include: sessionInclude,
      });

      const result = await Promise.all(
        sessions.map(async (s) => ({
          ...formatSession(s),
          photos: await signPhotos(s.photos),
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
        include: sessionInclude,
      });

      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      res.json({
        ...formatSession(session),
        photos: await signPhotos(session.photos),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching pumping session' });
    }
  },

  // POST /api/v1/pumping-sessions
  create: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { side, pumpedAt, amountMl, notes, babyId, storageStatus, expirationDate, classification, instructions } = req.body;

      if (!side || !pumpedAt) {
        return res.status(400).json({ error: 'side and pumpedAt are required' });
      }
      if (!VALID_SIDES.includes(side)) {
        return res.status(400).json({ error: 'side must be LEFT, RIGHT, or BOTH' });
      }

      const status = storageStatus || 'FROZEN';
      if (!VALID_STORAGE.includes(status)) {
        return res.status(400).json({ error: 'storageStatus must be FROZEN, REFRIGERATED, or CONSUMED' });
      }
      if (classification && !VALID_CLASSIFICATION.includes(classification)) {
        return res.status(400).json({ error: 'classification must be DAY or NIGHT' });
      }

      // Verify baby belongs to user if provided
      let babyName: string | null = null;
      if (babyId) {
        const baby = await prisma.baby.findUnique({ where: { id: babyId } });
        if (!baby || baby.userId !== userId) {
          return res.status(403).json({ error: 'Invalid babyId' });
        }
        babyName = baby.name;
      }

      const pumpedDate = new Date(pumpedAt);
      const folio = await generateUniqueFolio(side, pumpedDate, babyName);

      // Calculate expiration: use provided or default
      let expDate: Date | null = null;
      if (expirationDate) {
        expDate = new Date(expirationDate);
      } else {
        expDate = calculateExpiration(status, pumpedDate);
      }

      const session = await prisma.pumpingSession.create({
        data: {
          userId,
          side,
          pumpedAt: pumpedDate,
          amountMl: amountMl ?? 0,
          notes: notes?.trim() || null,
          babyId: babyId || null,
          folio,
          storageStatus: status,
          expirationDate: expDate,
          classification: classification || null,
          instructions: instructions?.trim() || null,
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: status,
            },
          },
        },
        include: sessionInclude,
      });

      res.status(201).json({
        ...formatSession(session),
        photos: await signPhotos(session.photos),
      });
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
      const { side, pumpedAt, amountMl, notes, babyId, storageStatus, expirationDate, classification, instructions } = req.body;

      const existing = await prisma.pumpingSession.findUnique({
        where: { id },
        include: { baby: { select: { name: true } } },
      });
      if (!existing) return res.status(404).json({ error: 'Session not found' });
      if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      if (side && !VALID_SIDES.includes(side)) {
        return res.status(400).json({ error: 'side must be LEFT, RIGHT, or BOTH' });
      }
      if (storageStatus && !VALID_STORAGE.includes(storageStatus)) {
        return res.status(400).json({ error: 'storageStatus must be FROZEN, REFRIGERATED, or CONSUMED' });
      }
      if (classification !== undefined && classification !== null && !VALID_CLASSIFICATION.includes(classification)) {
        return res.status(400).json({ error: 'classification must be DAY or NIGHT' });
      }

      // If storageStatus changes, create history entry and recalculate expiration
      const statusChanged = storageStatus && storageStatus !== existing.storageStatus;
      let newExpDate: Date | null | undefined = undefined;

      if (statusChanged) {
        // When status changes, recalculate expiration from NOW (not original pumpedAt)
        if (expirationDate) {
          newExpDate = new Date(expirationDate);
        } else {
          newExpDate = calculateExpiration(storageStatus, new Date());
        }
      } else if (expirationDate !== undefined) {
        newExpDate = expirationDate ? new Date(expirationDate) : null;
      }

      // Regenerate folio if side or baby changed
      let newFolio: string | undefined = undefined;
      const newSide = side || existing.side;
      const resolvedPumpedAt = pumpedAt ? new Date(pumpedAt) : existing.pumpedAt;
      let resolvedBabyName = existing.baby?.name || null;

      if (babyId !== undefined) {
        if (babyId) {
          const baby = await prisma.baby.findUnique({ where: { id: babyId } });
          if (!baby || baby.userId !== userId) {
            return res.status(403).json({ error: 'Invalid babyId' });
          }
          resolvedBabyName = baby.name;
        } else {
          resolvedBabyName = null;
        }
      }

      if (side || pumpedAt || babyId !== undefined) {
        newFolio = await generateUniqueFolio(newSide, resolvedPumpedAt, resolvedBabyName);
      }

      const updateData: any = {
        ...(side && { side }),
        ...(pumpedAt && { pumpedAt: resolvedPumpedAt }),
        ...(amountMl !== undefined && { amountMl }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(babyId !== undefined && { babyId: babyId || null }),
        ...(storageStatus && { storageStatus }),
        ...(newExpDate !== undefined && { expirationDate: newExpDate }),
        ...(classification !== undefined && { classification: classification || null }),
        ...(instructions !== undefined && { instructions: instructions?.trim() || null }),
        ...(newFolio && { folio: newFolio }),
      };

      // Use transaction if status changed (need to create history entry)
      let session;
      if (statusChanged) {
        [, session] = await prisma.$transaction([
          prisma.pumpingStatusHistory.create({
            data: {
              pumpingSessionId: id,
              fromStatus: existing.storageStatus,
              toStatus: storageStatus,
            },
          }),
          prisma.pumpingSession.update({
            where: { id },
            data: updateData,
            include: sessionInclude,
          }),
        ]);
      } else {
        session = await prisma.pumpingSession.update({
          where: { id },
          data: updateData,
          include: sessionInclude,
        });
      }

      res.json({
        ...formatSession(session),
        photos: await signPhotos(session.photos),
      });
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

  // GET /api/v1/pumping-sessions/folio/:folio (auth required - owner only)
  getByFolio: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { folio } = req.params;

      const session = await prisma.pumpingSession.findUnique({
        where: { folio },
        include: sessionInclude,
      });

      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      res.json({
        ...formatSession(session),
        photos: await signPhotos(session.photos),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching session by folio' });
    }
  },

  // GET /api/v1/pumping-sessions/public/:token (no auth - limited data)
  getByPublicToken: async (req: AuthRequest, res: Response) => {
    try {
      const { token } = req.params;

      const session = await prisma.pumpingSession.findUnique({
        where: { publicToken: token },
        include: {
          statusHistory: { orderBy: { changedAt: 'desc' as const } },
        },
      });

      if (!session) return res.status(404).json({ error: 'Session not found' });

      // Return limited public data: no baby name, no photos, no notes, no userId
      res.json({
        id: session.id,
        folio: session.folio,
        side: session.side,
        pumpedAt: session.pumpedAt,
        amountMl: Number(session.amountMl),
        storageStatus: session.storageStatus,
        expirationDate: session.expirationDate,
        classification: session.classification,
        consumedAt: session.consumedAt,
        instructions: session.instructions,
        statusHistory: session.statusHistory,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching session' });
    }
  },

  // PUT /api/v1/pumping-sessions/public/:token/status (no auth - public status change)
  updateStatusByPublicToken: async (req: AuthRequest, res: Response) => {
    try {
      const { token } = req.params;
      const { storageStatus, comment } = req.body;

      if (!storageStatus || !VALID_STORAGE.includes(storageStatus)) {
        return res.status(400).json({ error: 'storageStatus must be FROZEN, REFRIGERATED, or CONSUMED' });
      }

      const session = await prisma.pumpingSession.findUnique({ where: { publicToken: token } });
      if (!session) return res.status(404).json({ error: 'Session not found' });

      // Validate transition
      const allowed = VALID_TRANSITIONS[session.storageStatus] || [];
      if (!allowed.includes(storageStatus)) {
        return res.status(400).json({ error: `No se puede cambiar de ${session.storageStatus} a ${storageStatus}` });
      }

      // Check 15-min lock on CONSUMED
      if (session.storageStatus === 'CONSUMED' && session.consumedAt) {
        const elapsed = Date.now() - new Date(session.consumedAt).getTime();
        if (elapsed > CONSUMED_LOCK_MS) {
          return res.status(400).json({ error: 'El estado de consumo ya no puede modificarse (pasaron 15 min)' });
        }
      }

      const newExp = calculateExpiration(storageStatus, new Date());
      const isConsumed = storageStatus === 'CONSUMED';

      const [, updated] = await prisma.$transaction([
        prisma.pumpingStatusHistory.create({
          data: {
            pumpingSessionId: session.id,
            fromStatus: session.storageStatus,
            toStatus: storageStatus,
            comment: comment?.trim() || null,
          },
        }),
        prisma.pumpingSession.update({
          where: { id: session.id },
          data: {
            storageStatus,
            expirationDate: newExp,
            ...(isConsumed && { consumedAt: new Date() }),
          },
          include: { statusHistory: { orderBy: { changedAt: 'desc' as const } } },
        }),
      ]);

      // Return limited data
      res.json({
        id: updated.id,
        folio: updated.folio,
        side: updated.side,
        pumpedAt: updated.pumpedAt,
        amountMl: Number(updated.amountMl),
        storageStatus: updated.storageStatus,
        expirationDate: updated.expirationDate,
        classification: updated.classification,
        consumedAt: updated.consumedAt,
        instructions: updated.instructions,
        statusHistory: updated.statusHistory,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error updating status' });
    }
  },

  // PUT /api/v1/pumping-sessions/folio/:folio/status (auth required - owner only)
  updateStatusByFolio: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { folio } = req.params;
      const { storageStatus, comment } = req.body;

      if (!storageStatus || !VALID_STORAGE.includes(storageStatus)) {
        return res.status(400).json({ error: 'storageStatus must be FROZEN, REFRIGERATED, or CONSUMED' });
      }

      const session = await prisma.pumpingSession.findUnique({ where: { folio } });
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      // Validate transition
      const allowed = VALID_TRANSITIONS[session.storageStatus] || [];
      if (!allowed.includes(storageStatus)) {
        return res.status(400).json({ error: `No se puede cambiar de ${session.storageStatus} a ${storageStatus}` });
      }

      // Check 15-min lock on CONSUMED
      if (session.storageStatus === 'CONSUMED' && session.consumedAt) {
        const elapsed = Date.now() - new Date(session.consumedAt).getTime();
        if (elapsed > CONSUMED_LOCK_MS) {
          return res.status(400).json({ error: 'El estado de consumo ya no puede modificarse (pasaron 15 min)' });
        }
      }

      const newExp = calculateExpiration(storageStatus, new Date());
      const isConsumed = storageStatus === 'CONSUMED';

      const [, updated] = await prisma.$transaction([
        prisma.pumpingStatusHistory.create({
          data: {
            pumpingSessionId: session.id,
            fromStatus: session.storageStatus,
            toStatus: storageStatus,
            comment: comment?.trim() || null,
          },
        }),
        prisma.pumpingSession.update({
          where: { id: session.id },
          data: {
            storageStatus,
            expirationDate: newExp,
            ...(isConsumed && { consumedAt: new Date() }),
          },
          include: sessionInclude,
        }),
      ]);

      res.json({
        ...formatSession(updated),
        photos: await signPhotos(updated.photos),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error updating status' });
    }
  },

  // PUT /api/v1/pumping-sessions/folio/:folio/instructions (auth required - owner only)
  updateInstructionsByFolio: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { folio } = req.params;
      const { instructions } = req.body;

      const session = await prisma.pumpingSession.findUnique({ where: { folio } });
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const updated = await prisma.pumpingSession.update({
        where: { id: session.id },
        data: { instructions: instructions?.trim() || null },
        include: sessionInclude,
      });

      res.json({
        ...formatSession(updated),
        photos: await signPhotos(updated.photos),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error updating instructions' });
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
        .rotate()
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
