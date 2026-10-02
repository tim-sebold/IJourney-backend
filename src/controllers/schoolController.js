import { db } from '../config/firebaseAdmin.js';
import {
    generateSchoolCode,
    isValidSchoolCode,
    normalizeSchoolCode,
} from '../utils/schoolCode.js';

/**
 * School codes attribute a signup to a school: a student types the code on the
 * register form and it is stamped on their user document as `schoolCode`. The
 * code is a label, not a gate — registration works without one — so a leaked
 * code costs miscounted signups, never access.
 *
 * `schools/{code}` is keyed by the normalised code. The school's name lives only
 * here, not on the user document, so renaming a school never leaves stale copies.
 */
const schools = () => db.collection('schools');

const MAX_SCHOOL_NAME_LENGTH = 120;

const cleanSchoolName = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ');
};

const toIsoDate = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return null;
};

/**
 * Resolves a code typed at signup to an active school, or null. Used by
 * `registerUser` before the account is created.
 */
export const findActiveSchool = async (rawCode) => {
    const code = normalizeSchoolCode(rawCode);
    if (!isValidSchoolCode(code)) return null;

    const snap = await schools().doc(code).get();
    if (!snap.exists || snap.data()?.active !== true) return null;

    return { code, schoolName: snap.data().schoolName };
};

const countUsersWithCode = async (code) => {
    const snap = await db.collection('users').where('schoolCode', '==', code).count().get();
    return snap.data().count;
};

/**
 * Every school with the number of accounts that signed up under its code, plus
 * how many accounts carry no code at all. `unassigned` is reported explicitly:
 * accounts created before codes existed, or through Google sign-in, have none,
 * so a school's count is "signed up with this code", not "attends this school".
 */
export const listSchools = async (req, res) => {
    try {
        const [schoolSnap, totalSnap] = await Promise.all([
            schools().get(),
            db.collection('users').count().get(),
        ]);

        const rows = await Promise.all(
            schoolSnap.docs.map(async (doc) => {
                const data = doc.data();
                return {
                    code: doc.id,
                    schoolName: data.schoolName ?? '',
                    active: data.active === true,
                    createdAt: toIsoDate(data.createdAt),
                    signups: await countUsersWithCode(doc.id),
                };
            })
        );

        rows.sort((a, b) => a.schoolName.localeCompare(b.schoolName));

        const totalUsers = totalSnap.data().count;
        const assigned = rows.reduce((sum, row) => sum + row.signups, 0);

        res.json({
            schools: rows,
            totalUsers,
            unassigned: Math.max(totalUsers - assigned, 0),
        });
    } catch (error) {
        console.error('Error listing schools:', error.message);
        res.status(500).json({ error: 'Failed to list schools.' });
    }
};

export const createSchool = async (req, res) => {
    const schoolName = cleanSchoolName(req.body?.schoolName);
    if (schoolName.length < 2 || schoolName.length > MAX_SCHOOL_NAME_LENGTH) {
        return res.status(400).json({ error: 'Enter the school name.' });
    }

    const requested = req.body?.code;
    const hasRequestedCode = typeof requested === 'string' && requested.trim() !== '';
    if (requested != null && typeof requested !== 'string') {
        return res.status(400).json({ error: 'The code must be text.' });
    }

    const requestedCode = normalizeSchoolCode(requested);
    if (hasRequestedCode && !isValidSchoolCode(requestedCode)) {
        return res.status(400).json({
            error: 'A code is 4 to 20 letters and numbers, with no other characters.'
        });
    }

    try {
        // `create` fails if the document exists, so two admins (or a generated
        // code that happens to collide) can never silently overwrite a school.
        const attempts = hasRequestedCode ? 1 : 5;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            const code = hasRequestedCode ? requestedCode : generateSchoolCode();
            try {
                await schools().doc(code).create({
                    schoolName,
                    active: true,
                    createdAt: new Date(),
                    createdBy: req.user.uid,
                });
                return res.status(201).json({
                    school: { code, schoolName, active: true, signups: 0 }
                });
            } catch (error) {
                const alreadyExists = error?.code === 6 || error?.code === 'already-exists';
                if (!alreadyExists) throw error;
                if (hasRequestedCode) {
                    return res.status(409).json({ error: `The code ${code} is already in use.` });
                }
            }
        }
        return res.status(500).json({ error: 'Could not generate a unique code. Try again.' });
    } catch (error) {
        console.error('Error creating school:', error.message);
        res.status(500).json({ error: 'Failed to create the school.' });
    }
};

/**
 * Renames a school or switches its code on and off. The code itself is the
 * document id and is already on every account that used it, so it never changes;
 * a retired code is deactivated rather than deleted, which keeps its count.
 */
export const updateSchool = async (req, res) => {
    const code = normalizeSchoolCode(req.params.code);
    if (!isValidSchoolCode(code)) return res.status(404).json({ error: 'School not found.' });

    const update = {};

    if (req.body?.schoolName !== undefined) {
        const schoolName = cleanSchoolName(req.body.schoolName);
        if (schoolName.length < 2 || schoolName.length > MAX_SCHOOL_NAME_LENGTH) {
            return res.status(400).json({ error: 'Enter the school name.' });
        }
        update.schoolName = schoolName;
    }

    if (req.body?.active !== undefined) {
        if (typeof req.body.active !== 'boolean') {
            return res.status(400).json({ error: 'active must be true or false.' });
        }
        update.active = req.body.active;
    }

    if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'Nothing to update.' });
    }

    try {
        const ref = schools().doc(code);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'School not found.' });

        await ref.update({ ...update, updatedAt: new Date() });

        const data = { ...snap.data(), ...update };
        res.json({
            school: {
                code,
                schoolName: data.schoolName ?? '',
                active: data.active === true,
            }
        });
    } catch (error) {
        console.error('Error updating school:', error.message);
        res.status(500).json({ error: 'Failed to update the school.' });
    }
};
