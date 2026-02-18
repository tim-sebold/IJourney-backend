import express from 'express';
import { handleChatMessage } from '../controllers/chatbotController.js';

const router = express.Router();

router.post('/message', handleChatMessage);

export default router;
