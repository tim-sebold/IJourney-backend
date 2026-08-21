import express from 'express';
import { getUserProfile, updateUserProfile, getUserProgress, getDashboardData } from '../controllers/userController.js';

const router = express.Router();

router.get('/profile', getUserProfile);

router.put('/profile', updateUserProfile);

router.get('/progress', getUserProgress);

router.get('/dashboard', getDashboardData);

export default router;
