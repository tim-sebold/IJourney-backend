import express from 'express';
import {
    getAllUsers,
    getUserProgress,
    getAnalytics,
    getChatbotLogs,
    manageMilestones,
    deleteUser
} from '../controllers/adminController.js';
import { verifyAdminRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyAdminRole);

router.get('/users', getAllUsers);
router.get('/progress/:userId', getUserProgress);
router.get('/analytics', getAnalytics);
router.get('/chatlogs', getChatbotLogs);
router.post('/milestones', manageMilestones);
router.delete('/user/:userId', deleteUser);

export default router;
