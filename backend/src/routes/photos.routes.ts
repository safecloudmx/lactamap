import { Router } from 'express';
import multer from 'multer';
import { photosController } from '../controllers/photos.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/lactarios/:lactarioId/photos', authenticate, upload.single('photo'), photosController.upload);
router.delete('/photos/:id', authenticate, photosController.deletePhoto);

export default router;
