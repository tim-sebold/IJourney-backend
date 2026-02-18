import express from 'express';
import { getUserProfile, updateUserProfile, getUserProgress } from '../controllers/userController.js';

const router = express.Router();

// GET /user/profile
router.get('/profile', getUserProfile);

// PUT /user/profile
router.put('/profile', updateUserProfile);

// GET /user/progress
router.get('/progress', getUserProgress);

export default router;
