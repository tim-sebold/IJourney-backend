// controllers/courseController.js
import { db } from '../config/firebaseAdmin.js';
import { normalizeMilestoneKey, toProgressMilestoneKey } from '../utils/milestoneKey.js';

export const getMilestoneContent = async (req, res) => {
    try {
        const milestoneId = normalizeMilestoneKey(req.params.milestoneId);
        const doc = await db.collection('milestones').doc(milestoneId).get();

        if (!doc.exists)
            return res.status(404).json({ message: 'Milestone not found' });

        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getMilestoneResponse = async (req, res) => {
    try {
        const milestoneId = normalizeMilestoneKey(req.params.milestoneId);
        const userId = req.user.uid;

        const doc = await db.collection('responses').doc(userId)
            .collection('milestones').doc(milestoneId).get();

        if (!doc.exists)
            return res.status(404).json({ message: 'Milestone response not found' });

        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export const submitMilestoneResponse = async (req, res) => {
    try {
        const milestoneId = normalizeMilestoneKey(req.params.milestoneId);
        const userId = req.user.uid;
        const { responses } = req.body;

        if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
            return res.status(400).json({ error: "Missing or invalid responses." });
        }

        await db.collection('responses').doc(userId)
            .collection('milestones').doc(milestoneId)
            .set(
                {
                    responses,
                    submittedAt: new Date(),
                    status: 'submitted'
                },
                { merge: true }
            );

        res.status(201).json({ message: 'Response saved.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getUserProgress = async (req, res) => {
    try {
        const userId = req.user.uid;
        const doc = await db.collection('progress').doc(userId).get();

        if (!doc.exists) {
            return res.json({ progress: {}, currentMilestone: 1 });
        }

        const progress = doc.data();
        const completed = Object.keys(progress).filter(m => m !== 'certificate' && progress[m]?.completed);
        const currentMilestone = completed.length + 1;

        res.json({ progress, currentMilestone });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const unlockNextMilestone = async (req, res) => {
    try {
        const userId = req.user.uid;
        const milestoneId = toProgressMilestoneKey(req.body.milestoneId);
        const prevMilestoneId = toProgressMilestoneKey(req.body.prevMilestoneId);

        if (!milestoneId || !prevMilestoneId) {
            return res.status(400).json({ error: 'Missing milestoneId or prevMilestoneId.' });
        }

        const userProgressRef = db.collection('progress').doc(userId);
        const progress = (await userProgressRef.get()).data() || {};

        if (milestoneId !== "completed") {
            if (progress[milestoneId]?.unlocked) {

                return res.json({ message: 'Milestone already unlocked.' });
            }
        }

        if (prevMilestoneId !== "start") {
            const submittedResponse = await db.collection('responses').doc(userId)
                .collection('milestones').doc(normalizeMilestoneKey(prevMilestoneId)).get();

            if (!submittedResponse.exists || submittedResponse.data()?.status !== 'submitted') {
                return res.status(409).json({
                    error: 'Submit the current milestone before unlocking the next one.'
                });
            }

            await userProgressRef.set({
                [prevMilestoneId]: { completed: true, completedAt: new Date() }
            }, { merge: true });
        }

        if (milestoneId !== "completed") {
            await userProgressRef.set({
                [milestoneId]: { unlocked: true, unlockedAt: new Date(), completed: false }
            }, { merge: true });
        }

        if (milestoneId === "completed") {
            res.json({ message: `Your Journey was completed successfully!!!` })
        } else {
            res.json({ message: `Milestone ${milestoneId} unlocked.` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const saveDraftResponse = async (req, res) => {
    try {
        const userId = req.user.uid;
        const milestoneId = normalizeMilestoneKey(req.params.milestoneId);
        const { responses } = req.body;

        if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
            return res.status(400).json({ error: 'Missing or invalid responses.' });
        }

        await db.collection('responses').doc(userId)
            .collection('milestones').doc(milestoneId)
            .set({ responses, updatedAt: new Date(), status: 'draft' }, { merge: true });

        res.status(200).json({ message: 'Draft saved successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllMilestones = async (req, res) => {
    try {
        const snapshot = await db.collection('milestones').get();
        const milestones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json({ milestones });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
