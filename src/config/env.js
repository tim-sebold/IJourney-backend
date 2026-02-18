import dotenv from "dotenv";

dotenv.config();

export const ENV = {
    PORT: process.env.PORT || 5000,
    PROJECT_ID: process.env.PROJECT_ID || "path-to-purpose",
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    FIREBASE_KEY: process.env.FIREBASE_KEY,
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
};
