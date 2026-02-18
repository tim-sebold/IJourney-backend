import { db } from "../config/firebaseConfig.js";

export const saveProgress = async (userId, milestone, data) => {
    await db.collection("users")
        .doc(userId)
        .collection("progress")
        .doc(milestone)
        .set(data, { merge: true });
};

export const getProgress = async (userId) => {
    const snapshot = await db.collection("users")
        .doc(userId)
        .collection("progress")
        .get();

    const progress = {};
    snapshot.forEach(doc => {
        progress[doc.id] = doc.data();
    });
    return progress;
};

export const saveWorksheetResponse = async (userId, worksheet, response) => {
    await db.collection("users")
        .doc(userId)
        .collection("responses")
        .doc(worksheet)
        .set(response, { merge: true });
};
