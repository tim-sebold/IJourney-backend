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

const MAX_NAME_LENGTH = 80;
const MAX_AVATAR_URL_LENGTH = 2048;
const GENDERS = new Set(['female', 'male', 'nonbinary', 'prefer_not_say', '']);
const COUNTRIES = new Set(['us', 'ca', 'uk', 'au', 'in', '']);

const isPlainObject = (value) =>
    !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;

/**
 * One validator per field a user may change about themselves. Anything not
 * listed — `role`, `schoolCode`, `email`, `createdAt` — cannot be written through
 * this endpoint at all, whatever the request body carries.
 */
const PROFILE_FIELDS = {
    name: (value) => typeof value === 'string' &&
        value.trim().length >= 2 && value.trim().length <= MAX_NAME_LENGTH,
    displayName: (value) => typeof value === 'string' &&
        value.trim().length >= 2 && value.trim().length <= MAX_NAME_LENGTH,
    gender: (value) => GENDERS.has(value),
    country: (value) => COUNTRIES.has(value),
    // Holds the Storage download URL of the avatar, despite the legacy name.
    avatarBase64: (value) => value === '' || (typeof value === 'string' &&
        value.length <= MAX_AVATAR_URL_LENGTH && /^https:\/\//.test(value)),
    preferences: isPlainObject,
};

export const updateUserProfile = async (req, res) => {
    const uid = req.user.uid;
    const body = isPlainObject(req.body) ? req.body : {};

    // Only the fields that were actually sent are written. Firestore rejects
    // `undefined`, so passing the body straight through turned a request that
    // carried just one field into a 500.
    const update = {};

    for (const [field, isValid] of Object.entries(PROFILE_FIELDS)) {
        const value = body[field];
        if (value === undefined) continue;
        if (!isValid(value)) {
            return res.status(400).json({ error: `Invalid value for ${field}.` });
        }
        update[field] = typeof value === 'string' ? value.trim() : value;
    }

    if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'Nothing to update.' });
    }

    try {
        await db.collection('users').doc(uid).set({ ...update, updatedAt: new Date() }, { merge: true });

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
