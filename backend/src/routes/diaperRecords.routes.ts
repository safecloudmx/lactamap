import { Router } from 'express';
import { diaperRecordsController } from '../controllers/diaperRecords.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, diaperRecordsController.getAll);
router.get('/:id', authenticate, diaperRecordsController.getOne);
router.post('/', authenticate, diaperRecordsController.create);
router.put('/:id', authenticate, diaperRecordsController.update);
router.delete('/:id', authenticate, diaperRecordsController.delete);

export default router;
