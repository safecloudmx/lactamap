import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { GamificationService } from '../services/gamification.service';
import { signUrl } from '../lib/s3';

// Roles that bypass the approval queue (auto-ACTIVE)
const AUTO_APPROVE_ROLES = ['ADMIN', 'DISTINGUISHED', 'ELITE'];

const getAll = async (req: Request, res: Response) => {
  try {
    const { status, verified, search, mine } = req.query;
    const userId = (req as any).user?.userId;

    const where: any = {
      status: status ? String(status) : 'ACTIVE',
    };

    if (verified === 'true') {
      where.verifiedType = { not: 'NONE' };
    }

    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { address: { contains: search.trim(), mode: 'insensitive' } },
        { tags: { has: search.trim().toLowerCase() } },
      ];
    }

    if (mine === 'true' && userId) {
      where.ownerId = userId;
      delete where.status; // Show all statuses for own lactarios
    }

    const lactarios = await prisma.lactario.findMany({
      where,
      include: {
        amenities: true,
        owner: { select: { id: true, name: true, email: true } },
        photos: { where: { moderationStatus: 'APPROVED' }, orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { reviews: true } },
        submission: {
          select: {
            id: true,
            status: true,
            rejectionReason: true,
            rejectionNotes: true,
            createdAt: true,
          },
        },
      },
    });
    const result = await Promise.all(lactarios.map(async (l) => ({
      ...l,
      rating: Number(l.avgRating),
      reviewCount: l._count.reviews,
      isVerified: l.verifiedType !== 'NONE',
      imageUrl: await signUrl(l.photos[0]?.url ?? null),
      photos: l.photos.map((p) => ({ id: p.id, url: p.url })),
    })));
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching lactarios' });
  }
};

const getById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user?.role;
    const showReviewer = ['ADMIN', 'ELITE'].includes(userRole);

    const lactario = await prisma.lactario.findUnique({
      where: { id },
      include: {
        amenities: true,
        owner: { select: { id: true, name: true, email: true } },
        photos: { where: { moderationStatus: 'APPROVED' }, orderBy: { createdAt: 'desc' }, take: 5 },
        reviews: {
          include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
        submission: {
          include: {
            reviewedBy: showReviewer
              ? { select: { id: true, name: true, email: true } }
              : false,
          },
        },
      },
    });
    if (!lactario) return res.status(404).json({ error: 'Lactario not found' });
    const [signedPhotos, signedReviews] = await Promise.all([
      Promise.all(lactario.photos.map(async (p) => ({ id: p.id, url: await signUrl(p.url) }))),
      Promise.all(lactario.reviews.map(async (r) => ({
        ...r,
        user: { ...r.user, avatarUrl: await signUrl(r.user.avatarUrl) },
      }))),
    ]);
    res.json({
      ...lactario,
      rating: Number(lactario.avgRating),
      isVerified: lactario.verifiedType !== 'NONE',
      imageUrl: signedPhotos[0]?.url ?? null,
      photos: signedPhotos,
      reviews: signedReviews,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching lactario' });
  }
};

// Map frontend Amenity/Spec enum values (Spanish strings) to DB boolean fields
export const mapAmenitiesToDB = (amenities: string[]) => ({
  hasFridge: amenities.includes('Refrigerador') || amenities.includes('Congelador'),
  hasPower: amenities.includes('Enchufe'),
  hasSink: amenities.includes('Lavabo'),
  hasPrivacy: amenities.includes('Sala Privada') || amenities.includes('Privado'),
  hasNursingChair: amenities.includes('Sillón Lactancia') || amenities.includes('Cambiador'),
  isAccessible: amenities.includes('Accesible') || amenities.includes('Accessible'),
  hasAC: amenities.includes('Clima (A/C)') || amenities.includes('Climatizado'),
  hasStrollerAccess: false,
  isInBathroom: amenities.includes('Dentro de un Baño'),
  isOpen: amenities.includes('Abierto'),
});

const create = async (req: Request, res: Response) => {
  try {
    const { name, latitude, longitude, address, description, amenities, tags, placeType, genderAccess, isPrivate } = req.body;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'name, latitude and longitude are required' });
    }

    const amenityList: string[] = Array.isArray(amenities) ? amenities : [];
    const autoApprove = AUTO_APPROVE_ROLES.includes(userRole);
    const lactarioStatus = autoApprove ? 'ACTIVE' : 'PENDING';

    const tagList: string[] = Array.isArray(tags) ? tags.map((t: string) => t.toLowerCase().trim()).filter(Boolean) : [];

    const lactario = await prisma.lactario.create({
      data: {
        name,
        latitude,
        longitude,
        address,
        description,
        status: lactarioStatus,
        placeType: ['CAMBIADOR', 'BANO_FAMILIAR', 'PUNTO_INTERES'].includes(placeType) ? placeType : 'LACTARIO',
        ...(genderAccess && { genderAccess }),
        ...(isPrivate !== undefined && { isPrivate: Boolean(isPrivate) }),
        ownerId: userId,
        tags: tagList,
        amenities: {
          create: mapAmenitiesToDB(amenityList),
        },
      },
    });

    // Non-privileged roles → create submission record for review queue
    if (!autoApprove && userId) {
      await prisma.lactarioSubmission.create({
        data: {
          lactarioId: lactario.id,
          submittedById: userId,
          status: 'PENDING',
        },
      });
    }

    if (userId) {
      await GamificationService.addPoints(userId, 20, 'LACTARIO_SUBMITTED');
    }

    res.status(201).json({
      message: autoApprove ? 'Lactario publicado' : 'Lactario enviado para revisión',
      requiresReview: !autoApprove,
      lactario,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creating lactario' });
  }
};

const update = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    const lactario = await prisma.lactario.findUnique({ where: { id } });
    if (!lactario) return res.status(404).json({ error: 'Lactario not found' });

    if (lactario.ownerId !== userId && !['ADMIN', 'ELITE'].includes(userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, address, description, status, amenities, tags, latitude, longitude, genderAccess, isPrivate } = req.body;
    const tagList = Array.isArray(tags) ? tags.map((t: string) => t.toLowerCase().trim()).filter(Boolean) : undefined;

    const updated = await prisma.lactario.update({
      where: { id },
      data: {
        name, address, description, status,
        ...(tagList !== undefined && { tags: tagList }),
        ...(latitude !== undefined && { latitude: Number(latitude) }),
        ...(longitude !== undefined && { longitude: Number(longitude) }),
        ...(genderAccess !== undefined && { genderAccess }),
        ...(isPrivate !== undefined && { isPrivate: Boolean(isPrivate) }),
      },
    });

    // ADMIN/ELITE can also update amenities for pending reviews
    if (['ADMIN', 'ELITE'].includes(userRole) && amenities && Array.isArray(amenities)) {
      await prisma.lactarioAmenity.upsert({
        where: { lactarioId: id },
        create: { lactarioId: id, ...mapAmenitiesToDB(amenities) },
        update: mapAmenitiesToDB(amenities),
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating lactario' });
  }
};

const remove = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user?.role;

    if (userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can delete lactarios' });
    }

    const lactario = await prisma.lactario.findUnique({ where: { id } });
    if (!lactario) return res.status(404).json({ error: 'Lactario not found' });

    // Delete related records that don't have onDelete: Cascade in schema
    await prisma.$transaction([
      prisma.review.deleteMany({ where: { lactarioId: id } }),
      prisma.photo.deleteMany({ where: { lactarioId: id } }),
      prisma.maintenanceReport.deleteMany({ where: { lactarioId: id } }),
      prisma.lactarioAmenity.deleteMany({ where: { lactarioId: id } }),
      prisma.lactario.delete({ where: { id } }),
    ]);

    res.json({ message: 'Lactario deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting lactario' });
  }
};

const verify = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user?.role;

    if (!['ADMIN', 'ELITE'].includes(userRole)) {
      return res.status(403).json({ error: 'Solo Admin o Elite pueden verificar ubicaciones' });
    }

    const lactario = await prisma.lactario.findUnique({ where: { id } });
    if (!lactario) return res.status(404).json({ error: 'Lactario not found' });

    const updated = await prisma.lactario.update({
      where: { id },
      data: {
        verifiedType: 'ELITE',
        verificationCount: { increment: 1 },
      },
    });

    res.json({ message: 'Ubicación verificada', lactario: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar ubicación' });
  }
};

const unverify = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user?.role;

    if (!['ADMIN', 'ELITE'].includes(userRole)) {
      return res.status(403).json({ error: 'Solo Admin o Elite pueden modificar verificaciones' });
    }

    const lactario = await prisma.lactario.findUnique({ where: { id } });
    if (!lactario) return res.status(404).json({ error: 'Lactario not found' });

    const updated = await prisma.lactario.update({
      where: { id },
      data: {
        verifiedType: 'NONE',
        verificationCount: 0,
      },
    });

    res.json({ message: 'Verificación removida', lactario: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al remover verificación' });
  }
};

export default { getAll, getById, create, update, remove, verify, unverify };
