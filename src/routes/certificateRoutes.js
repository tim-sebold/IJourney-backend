import express from "express";
import { verifyFirebaseToken } from "../middleware/authMiddleware.js";
import { downloadCertificate, verifyCertificate } from "../controllers/certificateController.js";

const router = express.Router();

router.post("/download", verifyFirebaseToken, downloadCertificate);

router.get("/verify/:certificateId", verifyCertificate);

export default router;