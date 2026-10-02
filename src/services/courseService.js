import { db } from "../config/firebaseAdmin.js";
import { REQUIRED_RESPONSE_KEYS, toResponseKey } from "../config/courseManifest.js";

/**
 * The certificate is earned by the work itself: every milestone that collects a
 * response must have one submitted. Content-only pages carry no response document
 * and are deliberately not checked here — `unlockNextMilestone` is what records
 * that they were worked through, and `assertCompletedViaProgress` cross-checks it.
 */
export async function assertCourseCompletedByResponses(uid) {
    const outstanding = await findOutstandingMilestones(uid);
    if (outstanding.length) throw new CourseIncompleteError(outstanding);
    return true;
}

/**
 * Thrown when the certificate gate refuses a user. `outstanding` travels to the
 * client so the page can name the steps and link back to them — a content
 * revision can make a page start collecting work after a user has already passed
 * it, and "Course not completed" alone tells that user nothing they can act on.
 */
export class CourseIncompleteError extends Error {
    constructor(outstanding) {
        super(
            outstanding.length === 1
                ? "One step of the course still needs your answer before the certificate unlocks."
                : `${outstanding.length} steps of the course still need your answers before the certificate unlocks.`
        );
        this.name = "CourseIncompleteError";
        this.outstanding = outstanding;
    }
}

/**
 * Progress-form keys, in course order, of every response-collecting milestone
 * the user has not submitted — whether never saved or saved only as a draft.
 */
export async function findOutstandingMilestones(uid) {
    const milestonesRef = db.collection("responses").doc(uid).collection("milestones");

    const snaps = await Promise.all(
        REQUIRED_RESPONSE_KEYS.map((key) => milestonesRef.doc(toResponseKey(key)).get())
    );

    return REQUIRED_RESPONSE_KEYS.filter((key, i) => {
        const snap = snaps[i];
        return !snap.exists || snap.data()?.status !== "submitted";
    });
}
