import { admin, db } from '../config/firebaseAdmin.js';

export const getAllUsers = async (req, res) => {
    try {
        const snapshot = await db.collection('users').get();
        const users = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.status(200).json({
            success: true,
            message: "Getting all users is successful",
            data: {
                totalUsers: users.length,
                users
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

export const getUserProgress = async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await db.collection('progress').doc(userId).get();
        const progress = snapshot.exists ? snapshot.data() : {};
        res.status(200).json({ 
            success: true, 
            message: "Getting user progress is successful", 
            data: { progress } 
        });
    } catch (error) {
        console.error('Error fetching user progress:', error);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
};

export const getAnalytics = async (req, res) => {
    try {
        const [userSnap, progressSnap, sessionSnap] = await Promise.all([
            db.collection('users').get(),
            db.collection('progress').get(),
            db.collection('sessions').get()
        ]);

        const totalUsers = userSnap.size;
        const completedMilestones = progressSnap.docs.reduce((total, doc) => {
            return total + Object.entries(doc.data())
                .filter(([key, value]) => key !== 'certificate' && value?.completed === true).length;
        }, 0);
        const totalChats = sessionSnap.size;

        const avgCompletion =
            totalUsers > 0 ? (completedMilestones / totalUsers).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            message: "Getting analytics is successful",
            data: {
                totalUsers,
                totalChats,
                avgCompletion
            }
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
};

export const getChatbotLogs = async (req, res) => {
    try {
        const snapshot = await db
            .collection('sessions')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const logs = snapshot.docs.map(doc => doc.data());
        res.status(200).json({ 
            success: true, 
            message: "Getting chatbot logs is successful", 
            data: { logs } 
        });
    } catch (error) {
        console.error('Error fetching chatbot logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
};

export const manageMilestones = async (req, res) => {
    const { milestoneId, data } = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.getPrototypeOf(data) !== Object.prototype) {
        return res.status(400).json({ error: 'Milestone data must be a plain object.' });
    }
    if (milestoneId !== undefined && (typeof milestoneId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(milestoneId))) {
        return res.status(400).json({ error: 'Invalid milestone ID.' });
    }
    try {
        if (milestoneId) {
            await db.collection('milestones').doc(milestoneId).update(data);
            res.status(200).json({ 
                success: true, 
                message: 'Milestone updated successfully', 
                data: "" 
            });
        } else {
            const newDoc = await db.collection('milestones').add(data);
            res.status(201).json({ 
                success: true, 
                message: 'Milestone created', 
                id: newDoc.id 
            });
        }
    } catch (error) {
        console.error('Error managing milestones:', error);
        res.status(500).json({ error: 'Failed to manage milestones' });
    }
};

export const deleteUser = async (req, res) => {
    const { userId } = req.params;
    try {
        try {
            await admin.auth().deleteUser(userId);
        } catch (error) {
            if (error?.code !== 'auth/user-not-found') throw error;
        }

        await Promise.all([
            db.recursiveDelete(db.collection('users').doc(userId)),
            db.recursiveDelete(db.collection('progress').doc(userId)),
            db.recursiveDelete(db.collection('responses').doc(userId)),
        ]);

        res.status(200).json({ 
            success: true, 
            message: 'User deleted successfully', 
            data: "" 
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};
