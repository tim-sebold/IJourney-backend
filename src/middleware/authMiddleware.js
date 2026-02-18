import { admin } from "../config/firebaseAdmin.js";

export const verifyAdminRole = (req, res, next) => {
    const { role } = req.user;
    if (role !== 'admin') return res.status(403).json({ error: 'Admin access only' });
    next();
};

export const verifyFirebaseToken = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};
