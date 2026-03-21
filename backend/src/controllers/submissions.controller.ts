import { Request, Response } from 'express';
import prisma from '../lib/prisma';

const REVIEWER_ROLES = ['ADMIN', 'ELITE'];

// Labels for rejection reasons (for reference)
export const REJECTION_REASON_LABELS: Record<string, string> = {
  OBSCENE_CONTENT: 'Contenido obsceno',
  INCORRECT_CONTENT: 'Contenido erróneo',
  INTERNAL_TEST: 'Prueba interna',
  DUPLICATE: 'Duplicado',
  LOW_QUALITY_PHOTO: 'Foto de baja calidad',
  INCORRECT_LOCATION: 'Ubicación incorrecta',
  OTHER: 'Otro',
};

/**
 * GET /api/v1/submissions
 * List submissions. ADMIN/ELITE only.
 * Supports ?status=PENDING|APPROVED|REJECTED
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

    const submissions = await prisma.lactarioSubmission.findMany({
      where,
      include: {
        lactario: {
          include: { amenities: true, owner: { select: { id: true, name: true, email: true } } },
        },
        submittedBy: { select: { id: true, name: true, email: true, role: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(submissions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching submissions' });
  }
};

/**
 * PUT /api/v1/submissions/:id/approve
 * Approve a pending submission. ADMIN/ELITE only.
 * - Sets lactario status to ACTIVE
 * - If submitter was VISITOR, upgrades to CONTRIBUTOR
 * - Awards 50 points to submitter
 */
const approve = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reviewerId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!REVIEWER_ROLES.includes(userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const submission = await prisma.lactarioSubmission.findUnique({
      where: { id },
      include: { submittedBy: true, lactario: true },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    if (submission.status !== 'PENDING') {
      return res.status(400).json({ error: 'Submission is not pending' });
    }

    // Approve in a transaction
    await prisma.$transaction(async (tx) => {
      // Update submission
      await tx.lactarioSubmission.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      });

      // Activate lactario
      await tx.lactario.update({
        where: { id: submission.lactarioId },
        data: { status: 'ACTIVE' },
      });

      const submitter = submission.submittedBy;

      // VISITOR → CONTRIBUTOR on first approval
      if (submitter.role === 'VISITOR') {
        await tx.user.update({
          where: { id: submitter.id },
          data: { role: 'CONTRIBUTOR' },
        });
      }

      // Award 50 bonus points for approval
      await tx.user.update({
        where: { id: submitter.id },
        data: { points: { increment: 50 } },
      });
    });

    res.json({ message: 'Submission approved' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error approving submission' });
  }
};

/**
 * PUT /api/v1/submissions/:id/reject
 * Reject a pending submission. ADMIN/ELITE only.
 * Body: { rejectionReason, rejectionNotes? }
 * Consequences:
 *   OBSCENE_CONTENT → immediate account ban
 *   INCORRECT_CONTENT → increment counter; suspend at 5
 */
const reject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reviewerId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!REVIEWER_ROLES.includes(userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { rejectionReason, rejectionNotes } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ error: 'rejectionReason is required' });
    }

    const validReasons = Object.keys(REJECTION_REASON_LABELS);
    if (!validReasons.includes(rejectionReason)) {
      return res.status(400).json({ error: 'Invalid rejectionReason', valid: validReasons });
    }

    const submission = await prisma.lactarioSubmission.findUnique({
      where: { id },
      include: { submittedBy: true },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    if (submission.status !== 'PENDING') {
      return res.status(400).json({ error: 'Submission is not pending' });
    }

    await prisma.$transaction(async (tx) => {
      // Update submission
      await tx.lactarioSubmission.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason,
          rejectionNotes: rejectionNotes || null,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      });

      // Lactario stays PENDING (not published) on rejection
      // Apply consequences based on reason
      const submitter = submission.submittedBy;

      if (rejectionReason === 'OBSCENE_CONTENT') {
        // Immediate ban
        await tx.user.update({
          where: { id: submitter.id },
          data: { status: 'BANNED' },
        });
      } else if (rejectionReason === 'INCORRECT_CONTENT') {
        const newCount = submitter.incorrectContentCount + 1;
        const shouldSuspend = newCount >= 5;
        await tx.user.update({
          where: { id: submitter.id },
          data: {
            incorrectContentCount: newCount,
            status: shouldSuspend ? 'SUSPENDED' : submitter.status,
          },
        });
      }
    });

    res.json({ message: 'Submission rejected' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error rejecting submission' });
  }
};

/**
 * PUT /api/v1/submissions/:id/edit
 * ADMIN/ELITE can edit the lactario data attached to a pending submission.
 */
const editSubmission = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user?.role;

    if (!REVIEWER_ROLES.includes(userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const submission = await prisma.lactarioSubmission.findUnique({ where: { id } });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const { name, address, description, amenities } = req.body;

    await prisma.lactario.update({
      where: { id: submission.lactarioId },
      data: { name, address, description },
    });

    res.json({ message: 'Submission updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating submission' });
  }
};

export default { list, approve, reject, editSubmission };
