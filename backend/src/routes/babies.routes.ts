import { Router } from 'express';
import { babiesController } from '../controllers/babies.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, babiesController.getAll);
router.post('/', authenticate, babiesController.create);
router.put('/:id', authenticate, babiesController.update);
router.delete('/:id', authenticate, babiesController.delete);

export default router;
