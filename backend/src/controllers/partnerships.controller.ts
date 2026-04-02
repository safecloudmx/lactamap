import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { getPartnership } from '../lib/partnerships';
import { sendPartnerInviteEmail } from '../services/email.service';

const BABY_SELECT = { id: true, name: true, birthDate: true, avatarUrl: true, createdAt: true };

export const partnershipsController = {
  // POST /api/v1/partnerships/invite
  invite: async (req: AuthRequest, res: Response) => {
    try {
      const senderId = req.user!.userId;
      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email es requerido' });
      }

      const sender = await prisma.user.findUnique({ where: { id: senderId } });
      if (!sender) return res.status(404).json({ error: 'Usuario no encontrado' });

      if (email.toLowerCase() === sender.email.toLowerCase()) {
        return res.status(400).json({ error: 'No puedes vincularte contigo mismo' });
      }

      // Check sender doesn't already have an active partnership
      const existing = await getPartnership(senderId);
      if (existing) {
        return res.status(409).json({ error: 'Ya tienes una cuenta vinculada. Desvincúlala primero.' });
      }

      // Check no pending invite from this sender
      const pendingInvite = await prisma.partnerInvite.findFirst({
        where: { senderId, status: 'PENDING' },
      });
      if (pendingInvite) {
        return res.status(409).json({ error: 'Ya tienes una invitación pendiente. Cancélala primero.' });
      }

      // Find recipient
      const recipient = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!recipient) {
        return res.status(404).json({ error: 'No encontramos una cuenta con ese correo electrónico.' });
      }

      // Check recipient doesn't already have an active partnership
      const recipientPartnership = await getPartnership(recipient.id);
      if (recipientPartnership) {
        return res.status(409).json({ error: 'Esa cuenta ya está vinculada con otra cuenta.' });
      }

      // Create invite (expires in 24h)
      const invite = await prisma.partnerInvite.create({
        data: {
          senderId,
          recipientEmail: email.toLowerCase(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await sendPartnerInviteEmail(
        recipient.email,
        recipient.name ?? undefined,
        sender.name || sender.email,
        invite.token,
      );

      res.json({ message: 'Invitación enviada exitosamente.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al enviar la invitación' });
    }
  },

  // DELETE /api/v1/partnerships/invite  — cancel pending invite sent by current user
  cancelInvite: async (req: AuthRequest, res: Response) => {
    try {
      const senderId = req.user!.userId;
      const deleted = await prisma.partnerInvite.deleteMany({
        where: { senderId, status: 'PENDING' },
      });
      if (deleted.count === 0) {
        return res.status(404).json({ error: 'No hay invitación pendiente para cancelar' });
      }
      res.json({ message: 'Invitación cancelada' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al cancelar la invitación' });
    }
  },

  // GET /api/v1/partnerships/preview?token=xxx
  preview: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { token } = req.query;

      if (!token) return res.status(400).json({ error: 'Token requerido' });

      const invite = await prisma.partnerInvite.findUnique({
        where: { token: token as string },
        include: {
          sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      if (!invite) return res.status(404).json({ error: 'Invitación no encontrada' });

      if (invite.status === 'ACCEPTED') {
        return res.status(410).json({ error: 'Esta invitación ya fue aceptada' });
      }
      if (invite.status === 'REJECTED') {
        return res.status(410).json({ error: 'Esta invitación fue rechazada' });
      }
      if (invite.status === 'EXPIRED' || invite.expiresAt < new Date()) {
        await prisma.partnerInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
        return res.status(410).json({ error: 'Esta invitación expiró. Pide una nueva.' });
      }

      // Verify the authenticated user is the intended recipient
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (currentUser?.email.toLowerCase() !== invite.recipientEmail.toLowerCase()) {
        return res.status(403).json({ error: 'Esta invitación no pertenece a tu cuenta.' });
      }

      const senderBabies = await prisma.baby.findMany({
        where: { userId: invite.senderId },
        select: BABY_SELECT,
        orderBy: { createdAt: 'asc' },
      });
      const recipientBabies = await prisma.baby.findMany({
        where: { userId },
        select: BABY_SELECT,
        orderBy: { createdAt: 'asc' },
      });

      res.json({
        invite: {
          id: invite.id,
          token: invite.token,
          sender: invite.sender,
          expiresAt: invite.expiresAt,
        },
        senderBabies,
        recipientBabies,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al cargar la invitación' });
    }
  },

  // POST /api/v1/partnerships/confirm
  confirm: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { token, action, babyMerges } = req.body as {
        token: string;
        action: 'accept' | 'reject';
        babyMerges?: { keepBabyId: string; mergeBabyId: string }[];
      };

      if (!token || !action) {
        return res.status(400).json({ error: 'token y action son requeridos' });
      }

      const invite = await prisma.partnerInvite.findUnique({
        where: { token },
        include: { sender: { select: { email: true } } },
      });

      if (!invite) return res.status(404).json({ error: 'Invitación no encontrada' });
      if (invite.status !== 'PENDING') {
        return res.status(410).json({ error: 'Esta invitación ya no está activa' });
      }
      if (invite.expiresAt < new Date()) {
        await prisma.partnerInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
        return res.status(410).json({ error: 'Esta invitación expiró' });
      }

      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (currentUser?.email.toLowerCase() !== invite.recipientEmail.toLowerCase()) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      if (action === 'reject') {
        await prisma.partnerInvite.update({ where: { id: invite.id }, data: { status: 'REJECTED' } });
        return res.json({ message: 'Invitación rechazada' });
      }

      // === action === 'accept' ===

      // 1. Create partnership
      await prisma.userPartnership.create({
        data: { userAId: invite.senderId, userBId: userId },
      });

      // 2. Process baby merges (case 4.2)
      const mergedBabyIds = new Set<string>();
      if (Array.isArray(babyMerges) && babyMerges.length > 0) {
        for (const { keepBabyId, mergeBabyId } of babyMerges) {
          // Validate ownership: keepBabyId belongs to recipient, mergeBabyId to sender
          const keepBaby = await prisma.baby.findUnique({ where: { id: keepBabyId } });
          const mergeBaby = await prisma.baby.findUnique({ where: { id: mergeBabyId } });
          if (!keepBaby || keepBaby.userId !== userId) continue;
          if (!mergeBaby || mergeBaby.userId !== invite.senderId) continue;

          // Reassign all records from mergeBaby → keepBaby
          await prisma.nursingSession.updateMany({ where: { babyId: mergeBabyId }, data: { babyId: keepBabyId } });
          await prisma.pumpingSession.updateMany({ where: { babyId: mergeBabyId }, data: { babyId: keepBabyId } });
          await prisma.sleepSession.updateMany({ where: { babyId: mergeBabyId }, data: { babyId: keepBabyId } });
          await prisma.diaperRecord.updateMany({ where: { babyId: mergeBabyId }, data: { babyId: keepBabyId } });
          await prisma.growthRecord.updateMany({ where: { babyId: mergeBabyId }, data: { babyId: keepBabyId } });

          // Delete the merged baby (BabyAccess cascade-deletes)
          await prisma.baby.delete({ where: { id: mergeBabyId } });
          mergedBabyIds.add(mergeBabyId);
        }
      }

      // 3. Create BabyAccess for remaining (non-merged) babies of both users
      const senderBabies = await prisma.baby.findMany({
        where: { userId: invite.senderId },
        select: { id: true },
      });
      const recipientBabies = await prisma.baby.findMany({
        where: { userId },
        select: { id: true },
      });

      // Give recipient access to sender's babies
      for (const baby of senderBabies) {
        await prisma.babyAccess.upsert({
          where: { babyId_userId: { babyId: baby.id, userId } },
          create: { babyId: baby.id, userId },
          update: {},
        });
      }

      // Give sender access to recipient's babies
      for (const baby of recipientBabies) {
        await prisma.babyAccess.upsert({
          where: { babyId_userId: { babyId: baby.id, userId: invite.senderId } },
          create: { babyId: baby.id, userId: invite.senderId },
          update: {},
        });
      }

      // 4. Mark invite accepted
      await prisma.partnerInvite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED' } });

      res.json({ message: 'Cuentas vinculadas exitosamente' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al confirmar la vinculación' });
    }
  },

  // GET /api/v1/partnerships/status
  status: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const partnership = await getPartnership(userId);
      let formattedPartnership = null;
      if (partnership) {
        const partner = partnership.userAId === userId ? partnership.userB : partnership.userA;
        formattedPartnership = {
          id: partnership.id,
          partner,
          createdAt: partnership.createdAt,
        };
      }

      const pendingInvite = await prisma.partnerInvite.findFirst({
        where: { senderId: userId, status: 'PENDING' },
        select: { id: true, recipientEmail: true, expiresAt: true, createdAt: true },
      });

      res.json({ partnership: formattedPartnership, pendingInvite: pendingInvite ?? null });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener el estado de vinculación' });
    }
  },

  // DELETE /api/v1/partnerships  — dissolve active partnership
  dissolve: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const partnership = await getPartnership(userId);
      if (!partnership) {
        return res.status(404).json({ error: 'No tienes una cuenta vinculada' });
      }

      const partnerId = partnership.userAId === userId ? partnership.userBId : partnership.userAId;

      // Remove cross-access: partner loses access to my babies, I lose access to partner's babies
      const myBabies = await prisma.baby.findMany({ where: { userId }, select: { id: true } });
      const partnerBabies = await prisma.baby.findMany({ where: { userId: partnerId }, select: { id: true } });

      for (const baby of myBabies) {
        await prisma.babyAccess.deleteMany({ where: { babyId: baby.id, userId: partnerId } });
      }
      for (const baby of partnerBabies) {
        await prisma.babyAccess.deleteMany({ where: { babyId: baby.id, userId } });
      }

      await prisma.userPartnership.delete({ where: { id: partnership.id } });

      res.json({ message: 'Vínculo disuelto exitosamente' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al disolver el vínculo' });
    }
  },
};
