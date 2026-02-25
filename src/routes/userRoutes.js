import express from 'express';
import { getUserProfile, updateUserProfile, getUserProgress } from '../controllers/userController.js';

const router = express.Router();

router.get('/profile', getUserProfile);

router.put('/profile', updateUserProfile);

router.get('/progress', getUserProgress);

export default router;
