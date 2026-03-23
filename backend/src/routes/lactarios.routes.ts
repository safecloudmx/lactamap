import { Router } from 'express';
import lactariosController from '../controllers/lactarios.controller';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', optionalAuth, lactariosController.getAll);
router.get('/:id', optionalAuth, lactariosController.getById);
router.post('/', authenticate, lactariosController.create);
router.put('/:id', authenticate, lactariosController.update);
router.delete('/:id', authenticate, lactariosController.remove);

export default router;
