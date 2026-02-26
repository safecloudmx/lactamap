import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { GamificationService } from '../services/gamification.service';

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
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    if (mine === 'true' && userId) {
      where.ownerId = userId;
      delete where.status; // Show all statuses for own lactarios
    }

    const lactarios = await prisma.lactario.findMany({
      where,
      include: { amenities: true, owner: { select: { name: true, email: true } } },
    });
    // Map avgRating → rating for frontend compatibility
    res.json(lactarios.map((l) => ({ ...l, rating: Number(l.avgRating) })));
  } catch (error) {
    res.status(500).json({ error: 'Error fetching lactarios' });
  }
};

const getById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lactario = await prisma.lactario.findUnique({
      where: { id },
      include: {
        amenities: true,
        owner: { select: { id: true, name: true, email: true } },
        reviews: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!lactario) return res.status(404).json({ error: 'Lactario not found' });
    res.json({ ...lactario, rating: Number(lactario.avgRating) });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching lactario' });
  }
};

// Map frontend Amenity enum values (Spanish strings) to DB boolean fields
const mapAmenitiesToDB = (amenities: string[]) => ({
  hasFridge: amenities.includes('Refrigerador') || amenities.includes('Congelador'),
  hasPower: amenities.includes('Enchufe'),
  hasSink: amenities.includes('Lavabo'),
  hasPrivacy: amenities.includes('Sala Privada'),
  hasNursingChair: amenities.includes('Sillón Lactancia') || amenities.includes('Cambiador'),
  isAccessible: false,
  hasAC: amenities.includes('Clima (A/C)'),
  hasStrollerAccess: false,
});

const create = async (req: Request, res: Response) => {
  try {
    const { name, latitude, longitude, address, description, amenities } = req.body;
    const userId = (req as any).user?.userId;

    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'name, latitude and longitude are required' });
    }

    const amenityList: string[] = Array.isArray(amenities) ? amenities : [];

    const lactario = await prisma.lactario.create({
      data: {
        name,
        latitude,
        longitude,
        address,
        description,
        status: 'ACTIVE',
        ownerId: userId,
        amenities: {
          create: mapAmenitiesToDB(amenityList),
        },
      },
    });

    if (userId) {
      await GamificationService.addPoints(userId, 20, 'LACTARIO_SUBMITTED');
    }

    res.status(201).json({ message: 'Lactario submitted', lactario });
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

    if (lactario.ownerId !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, address, description, status } = req.body;

    const updated = await prisma.lactario.update({
      where: { id },
      data: { name, address, description, status },
    });

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

    await prisma.lactario.delete({ where: { id } });
    res.json({ message: 'Lactario deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting lactario' });
  }
};

export default { getAll, getById, create, update, remove };
