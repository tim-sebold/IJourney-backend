import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";

dotenv.config();

const localServiceAccountUrl = new URL("../serviceAccount.json", import.meta.url);

const parseServiceAccount = (value, source) => {
    try {
        return JSON.parse(value);
    } catch (error) {
        throw new Error(`Invalid Firebase service-account JSON in ${source}.`, { cause: error });
    }
};

const getFirebaseCredential = () => {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
        return admin.credential.cert(parseServiceAccount(json, "FIREBASE_SERVICE_ACCOUNT_BASE64"));
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        return admin.credential.cert(
            parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, "FIREBASE_SERVICE_ACCOUNT_JSON")
        );
    }

    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
        return admin.credential.cert({
            projectId: FIREBASE_PROJECT_ID,
            clientEmail: FIREBASE_CLIENT_EMAIL,
            privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        });
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        return admin.credential.applicationDefault();
    }

    if (existsSync(localServiceAccountUrl)) {
        const json = readFileSync(localServiceAccountUrl, "utf8");
        return admin.credential.cert(parseServiceAccount(json, "src/serviceAccount.json"));
    }

    throw new Error(
        "Firebase credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_BASE64 on the server " +
        "or provide src/serviceAccount.json for local development."
    );
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: getFirebaseCredential(),
    });
}

const db = getFirestore();

export { admin, db };
