// controllers/userController.js
import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { calculateProgress } from '../utils/progressUtils.js';

const db = getFirestore();

export const getUserProfile = async (req, res) => {
    const uid = req.user.uid;
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
        res.json(userDoc.data());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const updateUserProfile = async (req, res) => {
    const uid = req.user.uid;
    const { displayName, preferences } = req.body;

    try {
        await db.collection('users').doc(uid).update({
            displayName,
            preferences,
            updatedAt: new Date(),
        });

        res.json({ success: true, message: 'Profile updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getUserProgress = async (req, res) => {
    const uid = req.user.uid;

    try {
        const progressSnap = await db
            .collection('progress')
            .doc(uid)
            .get();

        const progressData = progressSnap.data();
        const keys = Object.keys(progressData);
        var milestones = Object.values(progressData).map((item, index) => {
            return { ...item, milestoneId: keys[index] };
        });

        const summary = calculateProgress(milestones);

        res.json({ milestones: milestones, summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const saveUserResponse = async (req, res) => {
    const { milestoneId, formData } = req.body;
    const uid = req.user.uid;

    try {
        await db.collection('responses').add({
            userId: uid,
            milestoneId,
            formData,
            createdAt: new Date()
        });

        await db.collection('progress').doc(`${uid}_${milestoneId}`).set({
            userId: uid,
            milestoneId,
            completed: true,
            completedAt: new Date()
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getDashboardData = async (req, res) => {
    const uid = req.user.uid;
    try {
        const [userDoc, progressSnap] = await Promise.all([
            db.collection('users').doc(uid).get(),
            db.collection('user_progress').where('userId', '==', uid).get()
        ]);

        const progress = progressSnap.docs.map(doc => doc.data());
        const summary = calculateProgress(progress);

        res.json({
            profile: userDoc.data(),
            progressSummary: summary,
            totalMilestones: progress.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
