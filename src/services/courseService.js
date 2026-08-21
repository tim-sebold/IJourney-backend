import { db } from "../config/firebaseAdmin.js";
import { REQUIRED_RESPONSE_KEYS, toResponseKey } from "../config/courseManifest.js";

/**
 * The certificate is earned by the work itself: every milestone that collects a
 * response must have one submitted. Content-only pages carry no response document
 * and are deliberately not checked here — `unlockNextMilestone` is what records
 * that they were worked through, and `assertCompletedViaProgress` cross-checks it.
 */
export async function assertCourseCompletedByResponses(uid) {
    const milestonesRef = db.collection("responses").doc(uid).collection("milestones");

    const snaps = await Promise.all(
        REQUIRED_RESPONSE_KEYS.map((key) => milestonesRef.doc(toResponseKey(key)).get())
    );

    const missing = [];
    const notSubmitted = [];

    snaps.forEach((snap, i) => {
        const key = REQUIRED_RESPONSE_KEYS[i];
        if (!snap.exists) {
            missing.push(key);
            return;
        }
        const data = snap.data();
        if (data?.status !== "submitted") notSubmitted.push(key);
    });

    if (missing.length || notSubmitted.length) {
        const parts = [];
        if (missing.length) parts.push(`missing: ${missing.join(", ")}`);
        if (notSubmitted.length) parts.push(`not submitted: ${notSubmitted.join(", ")}`);
        throw new Error(`Course not completed (${parts.join(" | ")}).`);
    }

    return true;
}
