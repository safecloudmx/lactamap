import { Router } from 'express';
import { partnershipsController } from '../controllers/partnerships.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/status', authenticate, partnershipsController.status);
router.post('/invite', authenticate, partnershipsController.invite);
router.delete('/invite', authenticate, partnershipsController.cancelInvite);
router.get('/preview', authenticate, partnershipsController.preview);
router.post('/confirm', authenticate, partnershipsController.confirm);
router.delete('/', authenticate, partnershipsController.dissolve);

export default router;
