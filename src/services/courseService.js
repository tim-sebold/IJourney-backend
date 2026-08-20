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

export const fetchAllSubmittedMilestones = async (uid) => {

    const snap = await db
        .collection("responses")
        .doc(uid)
        .collection("milestones")
        .get();

    const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.status === "submitted");

    docs.sort((a, b) => {
        const ax = a.id.match(/milestone(\d+)_(\d+)/);
        const bx = b.id.match(/milestone(\d+)_(\d+)/);
        if (!ax || !bx) return a.id.localeCompare(b.id);
        const [am, ap] = [Number(ax[1]), Number(ax[2])];
        const [bm, bp] = [Number(bx[1]), Number(bx[2])];
        return am !== bm ? am - bm : ap - bp;
    });

    return docs;
}

function clampText(s, max = 800) {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…(truncated)" : s;
}

export const formatResponseValue = (v) => {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) return v.map(formatResponseValue).join(", ");
    if (typeof v === "object") return JSON.stringify(v, null, 2);
    return String(v);
}

export const normalizeMilestoneResponses = (milestoneDoc) => {
    const responses = milestoneDoc.responses || {};
    const entries = Object.entries(responses).map(([k, v]) => ({
        key: k,
        value: clampText(formatResponseValue(v)),
    }));

    entries.sort((a, b) => {
        const an = a.key.match(/^value(\d+)$/);
        const bn = b.key.match(/^value(\d+)$/);
        if (an && bn) return Number(an[1]) - Number(bn[1]);
        if (an) return -1;
        if (bn) return 1;
        return a.key.localeCompare(b.key);
    });

    return entries;
}