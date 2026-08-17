// controllers/userController.js
import { db } from '../config/firebaseAdmin.js';
import { calculateProgress } from '../utils/progressUtils.js';
import { normalizeMilestoneKey, toProgressMilestoneKey } from '../utils/milestoneKey.js';

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

        const progressData = progressSnap.exists ? progressSnap.data() : {};
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
    const milestoneId = normalizeMilestoneKey(req.body.milestoneId);
    const { formData } = req.body;
    const uid = req.user.uid;

    if (!milestoneId || !formData || typeof formData !== 'object' || Array.isArray(formData)) {
        return res.status(400).json({ error: 'Missing or invalid milestone response.' });
    }

    try {
        await db.collection('responses').doc(uid).collection('milestones').doc(milestoneId).set({
            responses: formData,
            status: 'submitted',
            submittedAt: new Date()
        }, { merge: true });

        await db.collection('progress').doc(uid).set({
            [toProgressMilestoneKey(milestoneId)]: { completed: true, unlocked: true, completedAt: new Date() }
        }, { merge: true });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getDashboardData = async (req, res) => {
    const uid = req.user.uid;
    try {
        const [userDoc, progressDoc] = await Promise.all([
            db.collection('users').doc(uid).get(),
            db.collection('progress').doc(uid).get()
        ]);

        const progressData = progressDoc.exists ? progressDoc.data() : {};
        const progress = Object.entries(progressData)
            .filter(([key]) => key !== 'certificate')
            .map(([milestoneId, value]) => ({ milestoneId, ...value }));
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
