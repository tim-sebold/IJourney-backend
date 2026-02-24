import PDFDocument from "pdfkit";
import { admin } from "../config/firebaseAdmin.js";

/**
 * You MUST list the milestone keys you require.
 * Start simple: require milestone7_4 only OR full list.
 */
const REQUIRED_MILESTONES = [
    // Strong (recommended): include everything required
    // Example for milestone 7 only:
    "milestone7_1",
    "milestone7_2",
    "milestone7_3",
    "milestone7_4",
];

function makeCertificateId() {
    const year = new Date().getFullYear();
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `IJ-${year}-${rand}`;
}

async function assertCourseCompleted(uid) {
    const db = admin.firestore();
    const base = db.collection("responses").doc(uid).collection("milestones");

    const snaps = await Promise.all(REQUIRED_MILESTONES.map((k) => base.doc(k).get()));

    const missing = [];
    const notSubmitted = [];

    snaps.forEach((snap, idx) => {
        const key = REQUIRED_MILESTONES[idx];
        if (!snap.exists) missing.push(key);
        else if (snap.data()?.status !== "submitted") notSubmitted.push(key);
    });

    if (missing.length || notSubmitted.length) {
        const parts = [];
        if (missing.length) parts.push(`missing: ${missing.join(", ")}`);
        if (notSubmitted.length) parts.push(`not submitted: ${notSubmitted.join(", ")}`);
        throw new Error(`Course not completed (${parts.join(" | ")}).`);
    }
}

function buildPdfBuffer({ issuedToName, certificateId, issuedAt, verifyUrl }) {
    return new Promise((resolve) => {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const chunks = [];

        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));

        doc.fontSize(26).text("Certificate of Completion", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(16).text("iJourney: A Path to Purpose", { align: "center" });

        doc.moveDown(2);
        doc.fontSize(14).text("This certifies that", { align: "center" });
        doc.moveDown(0.8);
        doc.fontSize(22).text(issuedToName || "Participant", { align: "center" });

        doc.moveDown(2);
        doc.fontSize(12).text(`Certificate ID: ${certificateId}`, { align: "center" });
        doc.fontSize(12).text(`Issued on: ${new Date(issuedAt).toDateString()}`, { align: "center" });

        doc.moveDown(2);
        doc.fontSize(10).text(`Verify at: ${verifyUrl}`, { align: "center" });

        doc.end();
    });
}

/**
 * POST /api/certificates/download
 * - uses uid from Firebase token
 * - checks completion from responses/{uid}/milestones
 * - creates or reuses cert doc in certificates collection
 * - returns PDF
 */
export async function downloadCertificate(req, res) {
    try {
        console.log("req");
        
        const uid = req.user.uid;
        const db = admin.firestore();

        await assertCourseCompleted(uid);

        // Get user name (best effort)
        const userSnap = await db.collection("users").doc(uid).get();
        const userData = userSnap.exists ? userSnap.data() : {};
        const issuedToName =
            userData?.displayName ||
            userData?.name ||
            req.user.name ||
            req.user.email ||
            "Participant";

        // Reuse existing certificate for this user/course if exists
        const existing = await db
            .collection("certificates")
            .where("userId", "==", uid)
            .where("courseId", "==", "ijourney")
            .limit(1)
            .get();

        let certificateId;

        if (!existing.empty) {
            certificateId = existing.docs[0].id;
        } else {
            certificateId = makeCertificateId();
            await db.collection("certificates").doc(certificateId).set({
                certificateId,
                userId: uid,
                courseId: "ijourney",
                issuedToName,
                milestoneKey: "milestone7_4",
                issuedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        const certSnap = await db.collection("certificates").doc(certificateId).get();
        const cert = certSnap.data();
        const issuedAt = cert?.issuedAt?.toDate?.() || new Date();

        const verifyUrl = `https://i-journey.org/verify/${certificateId}`;

        const pdf = await buildPdfBuffer({
            issuedToName: cert.issuedToName,
            certificateId,
            issuedAt,
            verifyUrl,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="iJourney-Certificate-${certificateId}.pdf"`
        );

        return res.status(200).send(pdf);
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to download certificate.";
        return res.status(400).json({ error: message });
    }
}

/**
 * GET /api/certificates/verify/:certificateId
 * Public endpoint used by the verification page
 */
export async function verifyCertificate(req, res) {
    try {
        const { certificateId } = req.params;
        const db = admin.firestore();

        const snap = await db.collection("certificates").doc(certificateId).get();
        if (!snap.exists) {
            return res.status(404).json({ valid: false, error: "Certificate not found." });
        }

        const cert = snap.data();
        return res.json({
            valid: true,
            certificateId: cert.certificateId,
            courseTitle: "iJourney: A Path to Purpose",
            issuedToName: cert.issuedToName,
            issuedAt: cert.issuedAt?.toDate?.() ? cert.issuedAt.toDate().toISOString() : null,
        });
    } catch (e) {
        return res.status(500).json({ valid: false, error: "Verification failed." });
    }
}