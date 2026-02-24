import express from "express";
import { verifyFirebaseToken } from "../middleware/authMiddleware.js";
import { downloadCertificate, verifyCertificate } from "../controllers/certificateController.js";

const router = express.Router();

// Authenticated: issue/reuse + download PDF
router.post("/download", verifyFirebaseToken, downloadCertificate);

// Public: verify certificate
router.get("/verify/:certificateId", verifyFirebaseToken, verifyCertificate);

export default router;