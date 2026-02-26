import { Router } from 'express';
import lactariosController from '../controllers/lactarios.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', lactariosController.getAll);
router.get('/:id', lactariosController.getById);
router.post('/', authenticate, lactariosController.create);
router.put('/:id', authenticate, lactariosController.update);
router.delete('/:id', authenticate, lactariosController.remove);

export default router;
