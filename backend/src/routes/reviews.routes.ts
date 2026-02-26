import { Router } from 'express';
import { reviewsController } from '../controllers/reviews.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/lactario/:lactarioId', reviewsController.getByLactario);
router.post('/lactario/:lactarioId', authenticate, reviewsController.create);
router.delete('/:id', authenticate, reviewsController.remove);

export default router;
