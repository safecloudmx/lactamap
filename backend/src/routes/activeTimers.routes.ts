import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { activeTimersController } from '../controllers/activeTimers.controller';

const router = Router();

router.get('/partner', authenticate, activeTimersController.getPartner);
router.put('/partner', authenticate, activeTimersController.pushPartner);
router.delete('/partner/:type', authenticate, activeTimersController.clearPartner);
router.put('/', authenticate, activeTimersController.push);
router.delete('/:type', authenticate, activeTimersController.clear);

export default router;
