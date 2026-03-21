import { Router } from 'express';
import { nursingSessionsController } from '../controllers/nursingSessions.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, nursingSessionsController.getAll);
router.post('/', authenticate, nursingSessionsController.create);
router.delete('/:id', authenticate, nursingSessionsController.delete);

export default router;
