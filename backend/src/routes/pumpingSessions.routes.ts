import { Router } from 'express';
import multer from 'multer';
import { pumpingSessionsController } from '../controllers/pumpingSessions.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', authenticate, pumpingSessionsController.getAll);
router.get('/:id', authenticate, pumpingSessionsController.getOne);
router.post('/', authenticate, pumpingSessionsController.create);
router.put('/:id', authenticate, pumpingSessionsController.update);
router.delete('/:id', authenticate, pumpingSessionsController.delete);
router.post('/:id/photos', authenticate, upload.single('photo'), pumpingSessionsController.uploadPhoto);
router.delete('/:id/photos/:photoId', authenticate, pumpingSessionsController.deletePhoto);

export default router;
