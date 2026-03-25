import { Router } from 'express';
import multer from 'multer';
import { growthRecordsController } from '../controllers/growthRecords.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', authenticate, growthRecordsController.getAll);
router.post('/', authenticate, growthRecordsController.create);
router.put('/:id', authenticate, growthRecordsController.update);
router.delete('/:id', authenticate, growthRecordsController.delete);

router.post('/:id/photos', authenticate, upload.single('photo'), growthRecordsController.uploadPhoto);
router.delete('/:recordId/photos/:photoId', authenticate, growthRecordsController.deletePhoto);

export default router;
