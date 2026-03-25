import { Router } from 'express';
import multer from 'multer';
import { babiesController } from '../controllers/babies.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', authenticate, babiesController.getAll);
router.post('/', authenticate, babiesController.create);
router.put('/:id', authenticate, babiesController.update);
router.delete('/:id', authenticate, babiesController.delete);
router.post('/:id/avatar', authenticate, upload.single('avatar'), babiesController.uploadAvatar);

export default router;
