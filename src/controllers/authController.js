import { admin, db } from '../config/firebaseAdmin.js';

export const registerUser = async (req, res) => {
    const { email, password, name, role = 'user' } = req.body;

    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
        });

        await db.collection('users').doc(userRecord.uid).set({
            name,
            email,
            role,
            createdAt: new Date(),
            lastLogin: null,
            progress: [],
            displayName: name
        });

        res.status(201).json({
            message: 'User registered successfully',
            uid: userRecord.uid,
            success: true
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const loginUser = async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) return res.status(400).json({ error: 'Missing ID token' });

    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        const userRef = db.collection('users').doc(decoded.uid);

        await userRef.update({ lastLogin: new Date() });

        const userDoc = await userRef.get();
        res.json({
            message: 'Login successful',
            user: { uid: decoded.uid, ...userDoc.data() },
            success: true
        });
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

export const verifyToken = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split('Bearer ')[1];
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        res.json({ valid: true, uid: decoded.uid, email: decoded.email });
    } catch (error) {
        res.status(401).json({ valid: false, error: error.message });
    }
};

export const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const link = await admin.auth().generatePasswordResetLink(email);
        res.json({
            message: 'Password reset link sent',
            link,
            success: true
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

export const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    try {
        const response = await fetch(
            `https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
            }
        );

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        res.json({
            idToken: data.id_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

export const logoutUser = async (req, res) => {
    try {
        const uid = req.user?.uid;

        if (uid) {
            await admin.auth().revokeRefreshTokens(uid);
        }
        res.json({
            message: 'User logged out successfully',
            success: true,
            data: ""
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};


export const resetPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const link = await admin.auth().generatePasswordResetLink(email);
        res.json({
            message: 'Password reset email sent',
            link,
            data: ""
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const assignRole = async (req, res) => {
    const { uid, role } = req.body;
    try {
        await admin.auth().setCustomUserClaims(uid, { role });
        await db.collection('users').doc(uid).update({ role });
        res.json({ 
            message: `Role '${role}' assigned to user ${uid}`,
            success: true,
            data: ""
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


