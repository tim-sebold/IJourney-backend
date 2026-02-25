import PDFDocument from "pdfkit";
import { admin } from "../config/firebaseAdmin.js";
import { fetchAllSubmittedMilestones, normalizeMilestoneResponses } from "../services/courseService.js";

const FINAL_MILESTONE_KEY = "milestone7/4";

const REQUIRED_MILESTONE_KEYS = [
    "milestone7/4"
];

function makeCertificateId() {
    const year = new Date().getFullYear();
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `IJ-${year}-${rand}`;
}

async function assertCompletedViaProgress(uid) {
    const db = admin.firestore();
    const snap = await db.collection("progress").doc(uid).get();
    if (!snap.exists) throw new Error("No progress found.");

    const data = snap.data();

    const missingOrIncomplete = REQUIRED_MILESTONE_KEYS.filter((k) => {
        const node = data?.[k];
        return !(node && node.completed === true);
    });

    if (missingOrIncomplete.length) {
        throw new Error(`Course not completed (incomplete: ${missingOrIncomplete.join(", ")}).`);
    }

    return data;
}

export async function downloadCertificate(req, res) {
    try {
        const uid = req.user.uid;
        const db = admin.firestore();

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
        const verifyUrl = `https://i-journey.org/verify/${certificateId}`;

        const milestones = await fetchAllSubmittedMilestones(uid);
        console.log("milestones:", milestones);

        const pdf = await buildPdfWithMilestones({
            issuedToName: cert.issuedToName,
            certificateId,
            issuedAt,
            verifyUrl,
            milestones,
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
        const db = admin.firestore();

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
    } catch (e) {
        return res.status(500).json({ valid: false, error: "Verification failed." });
    }
}

export const addCertificateCoverPage = (doc, { issuedToName, certificateId, issuedAt, verifyUrl }) => {
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
}

export const addMilestoneSection = (doc, milestoneId, entries) => {
    doc.addPage();
    doc.fontSize(18).text(`Milestone: ${milestoneId}`, { underline: true });
    doc.moveDown(1);

    if (!entries.length) {
        doc.fontSize(12).text("No responses saved.");
        return;
    }

    entries.forEach(({ key, value }) => {
        doc.fontSize(12).text(`${key}:`, { continued: false });
        doc.fontSize(11).text(value || "-", { indent: 20 });
        doc.moveDown(0.6);
    });
}

export const buildPdfWithMilestones = async ({
    issuedToName,
    certificateId,
    issuedAt,
    verifyUrl,
    milestones,
}) => {
    return new Promise((resolve) => {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const chunks = [];

        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));

        addCertificateCoverPage(doc, { issuedToName, certificateId, issuedAt, verifyUrl });

        milestones.forEach((m) => {
            const entries = normalizeMilestoneResponses(m);
            addMilestoneSection(doc, m.id, entries);
        });

        doc.end();
    });
}