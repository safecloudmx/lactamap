import { Router } from 'express';
import multer from 'multer';
import { usersController } from '../controllers/users.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/profile', authenticate, usersController.getProfile);
router.put('/profile', authenticate, usersController.updateProfile);
router.post('/avatar', authenticate, upload.single('avatar'), usersController.uploadAvatar);
router.get('/leaderboard', usersController.getLeaderboard);

export default router;
