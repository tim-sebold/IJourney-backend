import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBMVygvvrzwsd1x5lUrPySp6pM21tzmKTc",
    authDomain: "path-to-purpose-bc1f3.firebaseapp.com",
    projectId: "path-to-purpose-bc1f3",
    storageBucket: "path-to-purpose-bc1f3.firebasestorage.app",
    messagingSenderId: "238138617047",
    appId: "1:238138617047:web:b7e7e2129b2a38e0ee9492",
    measurementId: "G-79WND4ERRG"
};

const app = initializeApp(firebaseConfig);

if (await isSupported()) {
    const analytics = getAnalytics(app);
}

export const auth = getAuth(app);
export const db = getFirestore(app);
