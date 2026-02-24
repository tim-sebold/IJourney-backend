import admin from "firebase-admin";

export async function assertCourseCompletedByResponses(uid) {
    const db = admin.firestore();

    // Decide strict vs minimum:
    const REQUIRED = [
        // Put your real list here (example only)
        "milestone7_1",
        "milestone7_2",
        "milestone7_3",
        "milestone7_4",
    ];

    const milestonesRef = db.collection("responses").doc(uid).collection("milestones");

    // Fetch all required docs in parallel
    const snaps = await Promise.all(
        REQUIRED.map((key) => milestonesRef.doc(key).get())
    );

    const missing = [];
    const notSubmitted = [];

    snaps.forEach((snap, i) => {
        const key = REQUIRED[i];
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