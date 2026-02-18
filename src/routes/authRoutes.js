// src/routes/authRoute.js

import express from 'express';
import {
  registerUser,
  loginUser,
  verifyToken,
  forgotPassword,
  refreshToken,
  logoutUser
} from '../controllers/authController.js';

const router = express.Router();

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerUser);

/**
 * @route   POST /auth/login
 * @desc    Authenticate user & return Firebase token
 * @access  Public
 */
router.post('/login', loginUser);

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
router.post('/forgot-password', forgotPassword);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh user’s ID token
 * @access  Protected
 */
router.post('/refresh', refreshToken);

/**
 * @route   POST /auth/logout
 * @desc    Log out current user
 * @access  Protected
 */
router.post('/logout', logoutUser);

export default router;
