import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { getPartnership, hasAccessToBaby } from '../lib/partnerships';
import { emitToPartner } from '../lib/socket';

// Helper — get the partner userId for a given user (null if no partnership)
async function getPartnerId(userId: string): Promise<string | null> {
  const p = await getPartnership(userId);
  if (!p) return null;
  return p.userAId === userId ? p.userBId : p.userAId;
}

export const activeTimersController = {
  // PUT /api/v1/active-timers  — upsert the caller's active timer state
  push: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const {
        type, startedAt,
        leftMs, rightMs, activeSide,
        pausedAt, totalPausedMs,
        babyId, babyName,
      } = req.body;

      if (!type || !['nursing', 'sleep'].includes(type)) {
        return res.status(400).json({ error: 'type must be nursing or sleep' });
      }
      if (!startedAt) {
        return res.status(400).json({ error: 'startedAt is required' });
      }
      if (babyId) {
        const ok = await hasAccessToBaby(userId, babyId);
        if (!ok) return res.status(403).json({ error: 'Invalid babyId' });
      }

      const timer = await prisma.activeTimer.upsert({
        where: { userId_type: { userId, type } },
        update: {
          startedAt: new Date(startedAt),
          leftMs: leftMs ?? 0,
          rightMs: rightMs ?? 0,
          activeSide: activeSide ?? null,
          pausedAt: pausedAt ? new Date(pausedAt) : null,
          totalPausedMs: totalPausedMs ?? 0,
          babyId: babyId ?? null,
          babyName: babyName ?? null,
        },
        create: {
          userId,
          type,
          startedAt: new Date(startedAt),
          leftMs: leftMs ?? 0,
          rightMs: rightMs ?? 0,
          activeSide: activeSide ?? null,
          pausedAt: pausedAt ? new Date(pausedAt) : null,
          totalPausedMs: totalPausedMs ?? 0,
          babyId: babyId ?? null,
          babyName: babyName ?? null,
        },
      });

      // Notify partner via WebSocket
      emitToPartner(userId, 'timer:updated', timer).catch(() => {});

      res.json(timer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error saving active timer' });
    }
  },

  // DELETE /api/v1/active-timers/:type  — remove caller's active timer (after stop)
  clear: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { type } = req.params;
      await prisma.activeTimer.deleteMany({ where: { userId, type } });

      // Notify partner that timer was stopped
      emitToPartner(userId, 'timer:cleared', { userId, type }).catch(() => {});

      res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error clearing active timer' });
    }
  },

  // GET /api/v1/active-timers/partner  — get partner's active timers (both types)
  getPartner: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const partnerId = await getPartnerId(userId);
      if (!partnerId) return res.json([]);

      const timers = await prisma.activeTimer.findMany({
        where: { userId: partnerId },
      });
      res.json(timers);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching partner timers' });
    }
  },

  // PUT /api/v1/active-timers/partner  — upsert partner's active timer (pause/resume from partner side)
  pushPartner: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const partnerId = await getPartnerId(userId);
      if (!partnerId) return res.status(404).json({ error: 'No partner found' });

      const {
        type, startedAt,
        leftMs, rightMs, activeSide,
        pausedAt, totalPausedMs,
        babyId, babyName,
      } = req.body;

      if (!type || !['nursing', 'sleep'].includes(type)) {
        return res.status(400).json({ error: 'type must be nursing or sleep' });
      }
      if (!startedAt) {
        return res.status(400).json({ error: 'startedAt is required' });
      }

      const timer = await prisma.activeTimer.upsert({
        where: { userId_type: { userId: partnerId, type } },
        update: {
          startedAt: new Date(startedAt),
          leftMs: leftMs ?? 0,
          rightMs: rightMs ?? 0,
          activeSide: activeSide ?? null,
          pausedAt: pausedAt ? new Date(pausedAt) : null,
          totalPausedMs: totalPausedMs ?? 0,
          babyId: babyId ?? null,
          babyName: babyName ?? null,
        },
        create: {
          userId: partnerId,
          type,
          startedAt: new Date(startedAt),
          leftMs: leftMs ?? 0,
          rightMs: rightMs ?? 0,
          activeSide: activeSide ?? null,
          pausedAt: pausedAt ? new Date(pausedAt) : null,
          totalPausedMs: totalPausedMs ?? 0,
          babyId: babyId ?? null,
          babyName: babyName ?? null,
        },
      });

      // Notify the partner (timer owner) that their timer was modified
      emitToPartner(userId, 'timer:updated', timer).catch(() => {});

      res.json(timer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error updating partner timer' });
    }
  },

  // DELETE /api/v1/active-timers/partner/:type  — clear partner's active timer (when stopping their session)
  // Also creates the session record for the timer owner so data is never lost.
  clearPartner: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { type } = req.params;
      const partnerId = await getPartnerId(userId);
      if (!partnerId) return res.status(404).json({ error: 'No partner found' });

      // Read the timer before deleting so we can save the session
      const timer = await prisma.activeTimer.findUnique({
        where: { userId_type: { userId: partnerId, type } },
      });

      if (timer) {
        const now = new Date();

        if (type === 'nursing') {
          let leftMs = timer.leftMs;
          let rightMs = timer.rightMs;
          // If timer was running, add elapsed since last server update
          if (!timer.pausedAt && timer.activeSide) {
            const sinceUpdate = now.getTime() - timer.updatedAt.getTime();
            if (timer.activeSide === 'left') leftMs += sinceUpdate;
            else rightMs += sinceUpdate;
          }
          const leftDuration = Math.floor(leftMs / 1000);
          const rightDuration = Math.floor(rightMs / 1000);
          const totalDuration = leftDuration + rightDuration;
          if (totalDuration > 0) {
            let lastSide: 'left' | 'right' | 'both' = 'both';
            if (leftMs > 0 && rightMs === 0) lastSide = 'left';
            else if (rightMs > 0 && leftMs === 0) lastSide = 'right';
            await prisma.nursingSession.create({
              data: {
                userId: partnerId,
                babyId: timer.babyId,
                startedAt: timer.startedAt,
                endedAt: now,
                leftDuration,
                rightDuration,
                totalDuration,
                totalPauseTime: Math.floor(timer.totalPausedMs / 1000),
                lastSide,
                notes: '',
              },
            });
          }
        } else {
          // sleep
          let totalDuration: number;
          if (timer.pausedAt) {
            totalDuration = Math.floor(
              (timer.pausedAt.getTime() - timer.startedAt.getTime() - timer.totalPausedMs) / 1000
            );
          } else {
            totalDuration = Math.floor(
              (now.getTime() - timer.startedAt.getTime() - timer.totalPausedMs) / 1000
            );
          }
          if (totalDuration > 0) {
            await prisma.sleepSession.create({
              data: {
                userId: partnerId,
                babyId: timer.babyId,
                startedAt: timer.startedAt,
                endedAt: now,
                totalDuration,
                totalPauseTime: Math.floor(timer.totalPausedMs / 1000),
                notes: '',
              },
            });
          }
        }
      }

      await prisma.activeTimer.deleteMany({ where: { userId: partnerId, type } });

      // Notify the partner that their timer was stopped
      emitToPartner(userId, 'timer:cleared', { userId: partnerId, type }).catch(() => {});

      res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error clearing partner timer' });
    }
  },
};
