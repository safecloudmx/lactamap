import { Router } from 'express';
import { sleepSessionsController } from '../controllers/sleepSessions.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, sleepSessionsController.getAll);
router.get('/:id', authenticate, sleepSessionsController.getOne);
router.post('/', authenticate, sleepSessionsController.create);
router.put('/:id', authenticate, sleepSessionsController.update);
router.delete('/:id', authenticate, sleepSessionsController.delete);

export default router;
