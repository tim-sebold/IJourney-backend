import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js'
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import certificateRoutes from './routes/certificateRoutes.js';

import { verifyAdminRole, verifyFirebaseToken } from './middleware/authMiddleware.js';

config();

const app = express();

// Render (and Cloud Run) terminate TLS at a proxy, so without this every request
// appears to come from the proxy's address and the auth rate limiter counts all
// users as one client. `TRUST_PROXY` is the number of proxy hops to trust.
app.set('trust proxy', Number.parseInt(process.env.TRUST_PROXY ?? '1', 10) || 0);

const allowedOrigins = new Set([
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || '').split(','),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://www.i-journey.org',
  'https://i-journey.org',
  'https://i-journey-7d945.web.app'
].filter(Boolean).map((origin) => origin.trim().replace(/\/$/, '')));

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) return callback(null, true);
    const error = new Error('Origin is not allowed by CORS.');
    error.status = 403;
    return callback(error);
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.send('iJourney backend is running ✅. Use /api/... endpoints.');
});
app.use('/api/auth', authRoutes);
app.use('/api/user', verifyFirebaseToken, userRoutes);
app.use('/api/admin', verifyFirebaseToken, verifyAdminRole, adminRoutes);
app.use('/api/courses', verifyFirebaseToken, courseRoutes);
app.use('/api/certificates', certificateRoutes);

app.use(errorHandler);

export default app;
