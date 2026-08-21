// controllers/courseController.js
import { db } from '../config/firebaseAdmin.js';
import { normalizeMilestoneKey, toProgressMilestoneKey } from '../utils/milestoneKey.js';
import {
    COMPLETED_KEY,
    isImmediateSuccessor,
    isKnownMilestone,
    requiresResponse,
    START_KEY,
    toResponseKey,
} from '../config/courseManifest.js';
import { buildStatementFeedback, STATEMENT_SECTION_KEYS } from '../services/statementFeedback.js';

/**
 * Resolves a `:milestoneId` route param to a manifest-backed pair of keys, so no
 * handler can read or write a response document for a milestone that doesn't exist.
 */
const resolveMilestoneParam = (value) => {
    const progressKey = toProgressMilestoneKey(value);
    if (!isKnownMilestone(progressKey)) return null;
    return { progressKey, responseKey: toResponseKey(progressKey) };
};

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
        const milestone = resolveMilestoneParam(req.params.milestoneId);
        if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

        const userId = req.user.uid;

        const doc = await db.collection('responses').doc(userId)
            .collection('milestones').doc(milestone.responseKey).get();

        if (!doc.exists)
            return res.status(404).json({ message: 'Milestone response not found' });

        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export const submitMilestoneResponse = async (req, res) => {
    try {
        const milestone = resolveMilestoneParam(req.params.milestoneId);
        if (!milestone) return res.status(404).json({ error: 'Milestone not found.' });

        if (!requiresResponse(milestone.progressKey)) {
            return res.status(400).json({
                error: `Milestone ${milestone.progressKey} does not collect responses.`
            });
        }

        const userId = req.user.uid;
        const { responses } = req.body;

        if (!responses || typeof responses !== 'object' || Array.isArray(responses) ||
            Object.keys(responses).length === 0) {
            return res.status(400).json({ error: "Missing or invalid responses." });
        }

        await db.collection('responses').doc(userId)
            .collection('milestones').doc(milestone.responseKey)
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

export const unlockNextMilestone = async (req, res) => {
    try {
        const userId = req.user.uid;
        const milestoneId = toProgressMilestoneKey(req.body.milestoneId);
        const prevMilestoneId = toProgressMilestoneKey(req.body.prevMilestoneId);

        if (!milestoneId || !prevMilestoneId) {
            return res.status(400).json({ error: 'Missing milestoneId or prevMilestoneId.' });
        }

        const targetIsSentinel = milestoneId === COMPLETED_KEY;
        const prevIsSentinel = prevMilestoneId === START_KEY;

        if (!targetIsSentinel && !isKnownMilestone(milestoneId)) {
            return res.status(400).json({ error: 'Unknown milestone.' });
        }
        if (!prevIsSentinel && !isKnownMilestone(prevMilestoneId)) {
            return res.status(400).json({ error: 'Unknown previous milestone.' });
        }
        // The course is a fixed chain; only the genuine next step may be unlocked.
        if (!isImmediateSuccessor(prevMilestoneId, milestoneId)) {
            return res.status(400).json({
                error: `Milestone ${milestoneId} does not follow ${prevMilestoneId}.`
            });
        }

        const userProgressRef = db.collection('progress').doc(userId);

        // Completing the previous step is what actually gates the certificate, so it
        // runs before the already-unlocked short-circuit — otherwise revisiting a page
        // would leave the step permanently incomplete.
        if (!prevIsSentinel) {
            if (requiresResponse(prevMilestoneId)) {
                const submittedResponse = await db.collection('responses').doc(userId)
                    .collection('milestones').doc(toResponseKey(prevMilestoneId)).get();

                if (!submittedResponse.exists || submittedResponse.data()?.status !== 'submitted') {
                    return res.status(409).json({
                        error: 'Submit the current milestone before unlocking the next one.'
                    });
                }
            }

            await userProgressRef.set({
                [prevMilestoneId]: { completed: true, completedAt: new Date() }
            }, { merge: true });
        }

        if (targetIsSentinel) {
            return res.json({ message: 'Your Journey was completed successfully!!!' });
        }

        const progress = (await userProgressRef.get()).data() || {};
        if (!progress[milestoneId]?.unlocked) {
            await userProgressRef.set({
                [milestoneId]: { unlocked: true, unlockedAt: new Date(), completed: false }
            }, { merge: true });
        }

        res.json({ message: `Milestone ${milestoneId} unlocked.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const saveDraftResponse = async (req, res) => {
    try {
        const milestone = resolveMilestoneParam(req.params.milestoneId);
        if (!milestone) return res.status(404).json({ error: 'Milestone not found.' });

        if (!requiresResponse(milestone.progressKey)) {
            return res.status(400).json({
                error: `Milestone ${milestone.progressKey} does not collect responses.`
            });
        }

        const userId = req.user.uid;
        const { responses } = req.body;

        if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
            return res.status(400).json({ error: 'Missing or invalid responses.' });
        }

        // A draft must never overwrite work that was already submitted.
        const existing = await db.collection('responses').doc(userId)
            .collection('milestones').doc(milestone.responseKey).get();
        const status = existing.data()?.status === 'submitted' ? 'submitted' : 'draft';

        await db.collection('responses').doc(userId)
            .collection('milestones').doc(milestone.responseKey)
            .set({ responses, updatedAt: new Date(), status }, { merge: true });

        res.status(200).json({ message: 'Draft saved successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/** Max characters accepted per statement section — far above any real answer. */
const MAX_SECTION_LENGTH = 2000;

/**
 * Reviews the M6.4 Journeyer's Statement draft. Reads the draft off the request so the
 * user gets feedback on what is on screen, not on whatever they last saved.
 */
export const getStatementFeedback = async (req, res) => {
    try {
        const statement = req.body?.statement;

        if (!statement || typeof statement !== 'object' || Array.isArray(statement)) {
            return res.status(400).json({ error: 'Missing or invalid statement.' });
        }

        const trimmed = {};
        for (const key of STATEMENT_SECTION_KEYS) {
            const value = statement[key];
            if (value != null && typeof value !== 'string') {
                return res.status(400).json({ error: `Section ${key} must be text.` });
            }
            if (typeof value === 'string' && value.length > MAX_SECTION_LENGTH) {
                return res.status(400).json({ error: `Section ${key} is too long.` });
            }
            trimmed[key] = typeof value === 'string' ? value : '';
        }

        return res.json({ feedback: buildStatementFeedback(trimmed) });
    } catch (error) {
        return res.status(500).json({ error: error.message });
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
