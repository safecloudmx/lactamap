import { Router } from 'express';
import { reviewsController } from '../controllers/reviews.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/reported', authenticate, reviewsController.getReported);
router.get('/lactario/:lactarioId', reviewsController.getByLactario);
router.post('/lactario/:lactarioId', authenticate, reviewsController.create);
router.put('/:id', authenticate, reviewsController.update);
router.delete('/:id', authenticate, reviewsController.remove);
router.post('/:id/report', authenticate, reviewsController.report);
router.put('/:id/unhide', authenticate, reviewsController.unhide);

export default router;
