import express from 'express';
import {
    getAllUsers,
    getUserProgress,
    getAnalytics,
    getChatbotLogs,
    manageMilestones,
    deleteUser
} from '../controllers/adminController.js';
import { assignRole } from '../controllers/authController.js';
import { verifyAdminRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Also applied where this router is mounted; kept here so the router is never
// reachable unguarded if it is ever mounted somewhere else.
router.use(verifyAdminRole);

router.get('/users', getAllUsers);

router.post('/role', assignRole);
router.get('/progress/:userId', getUserProgress);
router.get('/analytics', getAnalytics);
router.get('/chatlogs', getChatbotLogs);
router.post('/milestones', manageMilestones);
router.delete('/user/:userId', deleteUser);

export default router;
