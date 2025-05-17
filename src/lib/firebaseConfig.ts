
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, type Analytics } from "firebase/analytics";

// Your web app's Firebase configuration directly provided.
// IMPORTANT: For production, it's highly recommended to use environment variables
// (e.g., process.env.NEXT_PUBLIC_FIREBASE_API_KEY) and a .env.local file
// to keep your credentials secure and not hardcoded in the source code.
const firebaseConfig = {
  apiKey: "AIzaSyAl_saXELNCG9P9hYhFWX0GUZ1GqdGuYn8",
  authDomain: "learnify-207f4.firebaseapp.com",
  projectId: "learnify-207f4",
  storageBucket: "learnify-207f4.firebasestorage.app",
  messagingSenderId: "296451600716",
  appId: "1:296451600716:web:e2098260bfeb7a7473dfe9",
  measurementId: "G-2XJQHDRT8H"
};

// Initialize Firebase
let app;
let analytics: Analytics | null = null;

if (typeof window !== 'undefined' && !getApps().length) {
  app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);
} else if (typeof window !== 'undefined') {
  app = getApp();
  // Ensure analytics is initialized if app already exists client-side
  // This might not be strictly necessary if getAnalytics is idempotent or handles this,
  // but it's safer to ensure it's initialized with the existing app instance.
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Firebase Analytics could not be initialized on existing app instance:", e);
  }
} else {
  // Fallback for server-side rendering if needed, though client-side init is typical for these services
  // For server-side, a different initialization (Admin SDK) is usually used.
  // This client SDK setup is primarily for the browser.
  // If getApps() is used server-side and returns [], initializeApp would run.
  // If it's not the first init server-side, getApp() would be used.
  // However, auth/db/analytics are typically client-side.
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
}


const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, analytics };

