import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { mapAmenitiesToDB } from './lactarios.controller';

const REVIEWER_ROLES = ['ADMIN', 'ELITE'];
// Roles that can propose edits to any lactario
const DISTINGUISHED_ROLES = ['DISTINGUISHED', 'ADMIN', 'ELITE'];
// Roles that can only propose edits to their own lactarios
const OWNER_LEVEL_ROLES = ['CONTRIBUTOR', 'OWNER'];

/**
 * POST /api/v1/edit-proposals
 * Body: { lactarioId, name?, address?, description?, amenities?, tags? }
 * - VISITOR → 403
 * - CONTRIBUTOR/OWNER → only their own lactario
 * - DISTINGUISHED → any lactario
 * - ADMIN/ELITE → 400 (should use direct update endpoint)
 */
const create = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (userRole === 'VISITOR') {
      return res.status(403).json({ error: 'Los visitantes no pueden proponer cambios' });
    }

    const { lactarioId, name, address, description, amenities, tags } = req.body;

    if (!lactarioId) {
      return res.status(400).json({ error: 'lactarioId is required' });
    }

    const lactario = await prisma.lactario.findUnique({ where: { id: lactarioId } });
    if (!lactario) return res.status(404).json({ error: 'Lactario not found' });

    // CONTRIBUTOR/OWNER can only edit their own places
    if (OWNER_LEVEL_ROLES.includes(userRole) && lactario.ownerId !== userId) {
      return res.status(403).json({ error: 'Solo puedes proponer cambios a tus propios aportes' });
    }

    const proposal = await prisma.lactarioEditProposal.create({
      data: {
        lactarioId,
        proposedById: userId,
        name: name || null,
        address: address || null,
        description: description !== undefined ? description : null,
        amenities: Array.isArray(amenities) ? amenities : [],
        tags: Array.isArray(tags) ? tags : [],
      },
    });

    res.status(201).json({ message: 'Propuesta enviada para revisión', proposal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creating edit proposal' });
  }
};

/**
 * GET /api/v1/edit-proposals
 * ADMIN/ELITE only. Supports ?status=PENDING|APPROVED|REJECTED
 */
const list = async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (!REVIEWER_ROLES.includes(userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status } = req.query;
    const where: any = {};
    if (status) where.status = String(status);

    const proposals = await prisma.lactarioEditProposal.findMany({
      where,
      include: {
        lactario: { select: { id: true, name: true, address: true, placeType: true } },
        proposedBy: { select: { id: true, name: true, email: true, role: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(proposals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching edit proposals' });
  }
};

/**
 * PUT /api/v1/edit-proposals/:id/approve
 * ADMIN/ELITE only. Applies proposed changes to the lactario.
 */
const approve = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reviewerId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!REVIEWER_ROLES.includes(userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const proposal = await prisma.lactarioEditProposal.findUnique({ where: { id } });
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status !== 'PENDING') {
      return res.status(400).json({ error: 'Proposal is not pending' });
    }

    await prisma.$transaction(async (tx) => {
      // Build the lactario update data from non-null proposal fields
      const updateData: any = {};
      if (proposal.name) updateData.name = proposal.name;
      if (proposal.address) updateData.address = proposal.address;
      if (proposal.description !== null) updateData.description = proposal.description;
      if (proposal.tags.length > 0) updateData.tags = proposal.tags;

      if (Object.keys(updateData).length > 0) {
        await tx.lactario.update({ where: { id: proposal.lactarioId }, data: updateData });
      }

      // Apply amenity changes if present
      if (proposal.amenities.length > 0) {
        await tx.lactarioAmenity.upsert({
          where: { lactarioId: proposal.lactarioId },
          create: { lactarioId: proposal.lactarioId, ...mapAmenitiesToDB(proposal.amenities) },
          update: mapAmenitiesToDB(proposal.amenities),
        });
      }

      // Mark proposal approved
      await tx.lactarioEditProposal.update({
        where: { id },
        data: { status: 'APPROVED', reviewedById: reviewerId, reviewedAt: new Date() },
      });

      // Award 10 points to proposer
      await tx.user.update({
        where: { id: proposal.proposedById },
        data: { points: { increment: 10 } },
      });
    });

    res.json({ message: 'Propuesta aprobada y cambios aplicados' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error approving edit proposal' });
  }
};

/**
 * PUT /api/v1/edit-proposals/:id/reject
 * ADMIN/ELITE only. Body: { rejectionNotes? }
 */
const reject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reviewerId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!REVIEWER_ROLES.includes(userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const proposal = await prisma.lactarioEditProposal.findUnique({ where: { id } });
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status !== 'PENDING') {
      return res.status(400).json({ error: 'Proposal is not pending' });
    }

    const { rejectionNotes } = req.body;

    await prisma.lactarioEditProposal.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        rejectionNotes: rejectionNotes || null,
      },
    });

    res.json({ message: 'Propuesta rechazada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error rejecting edit proposal' });
  }
};

export default { create, list, approve, reject };
