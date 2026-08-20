// controllers/userController.js
import { db } from '../config/firebaseAdmin.js';
import { calculateProgress } from '../utils/progressUtils.js';

/**
 * Flattens a `progress/{uid}` document into milestone entries. The `certificate`
 * key lives in the same document but is not a milestone — leaving it in makes it
 * sort ahead of every real key and hijack the "current milestone" calculation.
 */
const toMilestoneEntries = (progressData) =>
    Object.entries(progressData)
        .filter(([key]) => key !== 'certificate')
        .map(([milestoneId, value]) => ({ ...value, milestoneId }));

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
        const milestones = toMilestoneEntries(progressData);
        const summary = calculateProgress(milestones);

        res.json({ milestones, summary });
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
        const progress = toMilestoneEntries(progressData);
        const summary = calculateProgress(progress);

        res.json({
            profile: userDoc.exists ? userDoc.data() : null,
            progressSummary: summary,
            totalMilestones: summary.total
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
