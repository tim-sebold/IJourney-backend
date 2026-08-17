import express from 'express';
import {
  registerUser,
  loginUser,
  verifyToken,
  forgotPassword,
  refreshToken,
  logoutUser
} from '../controllers/authController.js';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authLimiter, registerUser);

/**
 * @route   POST /auth/login
 * @desc    Authenticate user & return Firebase token
 * @access  Public
 */
router.post('/login', authLimiter, loginUser);

/**
 * @route   GET /auth/verify
 * @desc    Verify Firebase ID token
 * @access  Protected
 */
router.get('/verify', verifyToken);

/**
 * @route   POST /auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/forgot-password', authLimiter, forgotPassword);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh user’s ID token
 * @access  Protected
 */
router.post('/refresh', authLimiter, refreshToken);

/**
 * @route   POST /auth/logout
 * @desc    Log out current user
 * @access  Protected
 */
router.post('/logout', verifyFirebaseToken, logoutUser);

export default router;
