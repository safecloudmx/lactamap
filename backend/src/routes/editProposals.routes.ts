import { Router } from 'express';
import editProposalsController from '../controllers/editProposals.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/', authenticate, editProposalsController.create);
router.get('/', authenticate, editProposalsController.list);
router.put('/:id/approve', authenticate, editProposalsController.approve);
router.put('/:id/reject', authenticate, editProposalsController.reject);

export default router;
