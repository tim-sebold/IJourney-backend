import { getFirestore } from 'firebase-admin/firestore';
const db = getFirestore();

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
        const snapshot = await db
            .collection('user_progress')
            .where('userId', '==', userId)
            .get();

        const progress = snapshot.docs.map(doc => doc.data());
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
            db.collection('user_progress').get(),
            db.collection('sessions').get()
        ]);

        const totalUsers = userSnap.size;
        const totalProgress = progressSnap.size;
        const totalChats = sessionSnap.size;

        const avgCompletion =
            totalProgress > 0 ? (totalProgress / totalUsers).toFixed(2) : 0;

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
        await db.collection('users').doc(userId).delete();
        await admin.auth().deleteUser(userId);

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
