import { Router } from 'express';
import multer from 'multer';
import { pumpingSessionsController } from '../controllers/pumpingSessions.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', authenticate, pumpingSessionsController.getAll);

// Folio routes — must be BEFORE /:id to avoid matching "folio"/"public" as an id
router.get('/folio/:folio', authenticate, pumpingSessionsController.getByFolio);
router.put('/folio/:folio/status', authenticate, pumpingSessionsController.updateStatusByFolio);

// Public token routes — no auth, limited data
router.get('/public/:token', pumpingSessionsController.getByPublicToken);
router.put('/public/:token/status', pumpingSessionsController.updateStatusByPublicToken);

router.get('/:id', authenticate, pumpingSessionsController.getOne);
router.post('/', authenticate, pumpingSessionsController.create);
router.put('/:id', authenticate, pumpingSessionsController.update);
router.delete('/:id', authenticate, pumpingSessionsController.delete);
router.post('/:id/photos', authenticate, upload.single('photo'), pumpingSessionsController.uploadPhoto);
router.delete('/:id/photos/:photoId', authenticate, pumpingSessionsController.deletePhoto);

export default router;
