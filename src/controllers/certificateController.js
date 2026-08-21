import { admin, db } from "../config/firebaseAdmin.js";
import { assertCourseCompletedByResponses } from "../services/courseService.js";
import { CERTIFICATE_MILESTONE_KEY } from "../config/courseManifest.js";
import { buildCertificatePdf } from "../utils/certificateDocument.js";

const FINAL_MILESTONE_KEY = CERTIFICATE_MILESTONE_KEY;

function makeCertificateId() {
    const year = new Date().getFullYear();
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `IJ-${year}-${rand}`;
}

/**
 * Cross-checks the response-based gate against recorded progress: the user must
 * have reached the certificate page itself. `unlocked` is what we require rather
 * than `completed` — the page is only marked complete on the way *out* of it, and
 * the download button lives on the page.
 */
async function assertCompletedViaProgress(uid) {
    const snap = await db.collection("progress").doc(uid).get();
    if (!snap.exists) throw new Error("No progress found.");

    const data = snap.data();
    const node = data?.[CERTIFICATE_MILESTONE_KEY];

    if (!node || !(node.unlocked === true || node.completed === true)) {
        throw new Error(`Course not completed (incomplete: ${CERTIFICATE_MILESTONE_KEY}).`);
    }

    return data;
}

export async function downloadCertificate(req, res) {
    try {
        const uid = req.user.uid;
        await assertCourseCompletedByResponses(uid);
        await assertCompletedViaProgress(uid);

        const userSnap = await db.collection("users").doc(uid).get();
        const user = userSnap.exists ? userSnap.data() : {};
        const issuedToName = user?.displayName || user?.name || req.user.name || req.user.email || "Participant";

        const progressRef = db.collection("progress").doc(uid);
        const progressSnap = await progressRef.get();
        const progressData = progressSnap.data() || {};

        let cert = progressData.certificate;

        if (!cert?.certificateId) {
            cert = {
                certificateId: makeCertificateId(),
                issuedAt: admin.firestore.FieldValue.serverTimestamp(),
                issuedToName,
                courseId: "ijourney",
                finalMilestoneKey: FINAL_MILESTONE_KEY,
            };
            await progressRef.set({ certificate: cert }, { merge: true });

            const refreshed = await progressRef.get();
            cert = refreshed.data()?.certificate;
        }

        const certificateId = cert.certificateId;
        const issuedAt = cert.issuedAt?.toDate?.() || new Date();
        const frontendUrl = (process.env.FRONTEND_URL || "https://www.i-journey.org").replace(/\/$/, "");
        const verifyUrl = `${frontendUrl}/verify/${certificateId}`;

        // Only these four fields ever reach the document — see `CERTIFICATE_FIELDS`.
        const pdf = await buildCertificatePdf({
            issuedToName: cert.issuedToName,
            certificateId,
            issuedAt,
            verifyUrl,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="iJourney-Certificate-${certificateId}.pdf"`);
        return res.status(200).send(pdf);
    } catch (e) {
        return res.status(400).json({ error: e instanceof Error ? e.message : "Download failed." });
    }
}

export async function verifyCertificate(req, res) {
    try {
        const { certificateId } = req.params;
        const q = await db
            .collection("progress")
            .where("certificate.certificateId", "==", certificateId)
            .limit(1)
            .get();

        if (q.empty) {
            return res.status(404).json({ valid: false, error: "Certificate not found." });
        }

        const doc = q.docs[0].data();
        const cert = doc.certificate;

        return res.json({
            valid: true,
            certificateId: cert.certificateId,
            courseTitle: "iJourney: A Path to Purpose",
            issuedToName: cert.issuedToName,
            issuedAt: cert.issuedAt?.toDate?.() ? cert.issuedAt.toDate().toISOString() : null,
        });
    } catch {
        return res.status(500).json({ valid: false, error: "Verification failed." });
    }
}
