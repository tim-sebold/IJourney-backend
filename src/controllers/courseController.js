// controllers/courseController.js
import { getFirestore } from 'firebase-admin/firestore';
const db = getFirestore();

export const getMilestoneContent = async (req, res) => {
    try {
        const { milestoneId } = req.params;
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
        const { milestoneId } = req.params;
        const userId = req.user.uid;

        console.log(milestoneId)

        const doc = await db.collection('responses').doc(userId)
            .collection('milestones').doc(milestoneId).get();

        if (!doc.exists)
            return res.status(404).json({ message: 'Milestone response not found' });

        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {

    }
}

export const submitMilestoneResponse = async (req, res) => {
    try {
        const { milestoneId } = req.params;
        const { userId, responses } = req.body;

        if (!userId || !responses) {
            return res.status(400).json({ error: "Missing userId or responses." });
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
        const completed = Object.keys(progress).filter(m => progress[m].completed);
        const currentMilestone = completed.length + 1;

        res.json({ progress, currentMilestone });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const unlockNextMilestone = async (req, res) => {
    try {
        const { userId, milestoneId, prevMilestoneId } = req.body;

        const userProgressRef = db.collection('progress').doc(userId);
        const progress = (await userProgressRef.get()).data() || {};

        if (milestoneId !== "completed") {
            if (progress[milestoneId]?.unlocked) {
                
                return res.json({ message: 'Milestone already unlocked.' });
            }
        }

        if (prevMilestoneId !== "start") {
            await userProgressRef.set({
                [prevMilestoneId]: { completed: true }
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
        const { userId, milestoneId, responses } = req.body;

        await db.collection('responses').add({
            userId,
            milestoneId,
            responses,
            updatedAt: new Date(),
            status: 'draft'
        });

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
