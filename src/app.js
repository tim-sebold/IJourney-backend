import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js'
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import certificateRoutes from './routes/certificateRoutes.js';
// import chatbotRoutes from './routes/chatbotRoutes.js';

import { verifyAdminRole, verifyFirebaseToken } from './middleware/authMiddleware.js';

config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('iJourney backend is running ✅. Use /api/... endpoints.');
});
app.use('/api/auth', authRoutes);
app.use('/api/user', verifyFirebaseToken, userRoutes);
app.use('/api/admin', verifyFirebaseToken, verifyAdminRole, adminRoutes);
app.use('/api/courses', verifyFirebaseToken, courseRoutes);
app.use('/api/certificates', verifyFirebaseToken, certificateRoutes);
// app.use('/api/chatbot', chatbotRoutes);

app.use(errorHandler);

export default app;
