import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import submissionsController from '../controllers/submissions.controller';

const router = Router();

router.get('/', authenticate, submissionsController.list);
router.put('/:id/approve', authenticate, submissionsController.approve);
router.put('/:id/reject', authenticate, submissionsController.reject);
router.put('/:id/edit', authenticate, submissionsController.editSubmission);

export default router;
