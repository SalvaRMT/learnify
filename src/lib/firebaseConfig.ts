
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAnalytics, type Analytics } from "firebase/analytics";

// Your web app's Firebase configuration directly provided.
const firebaseConfig = {
  apiKey: "AIzaSyAl_saXELNCG9P9hYhFWX0GUZ1GqdGuYn8",
  authDomain: "learnify-207f4.firebaseapp.com",
  projectId: "learnify-207f4",
  storageBucket: "learnify-207f4.firebasestorage.app",
  messagingSenderId: "296451600716",
  appId: "1:296451600716:web:e2098260bfeb7a7473dfe9",
  measurementId: "G-2XJQHDRT8H"
};

let app: FirebaseApp;

// Initialize Firebase app only once
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp(); // Use the existing app if already initialized
}

const authInstance: Auth = getAuth(app);
const dbInstance: Firestore = getFirestore(app);
let analyticsInstance: Analytics | null = null;

if (typeof window !== 'undefined') {
  // Initialize Analytics only on the client side
  // Ensure it's only called once per app instance as well
  try {
    analyticsInstance = getAnalytics(app);
  } catch (e) {
    // console.warn("Firebase Analytics could not be initialized or already initialized:", e);
    // It's possible getAnalytics throws if called multiple times on the same app instance,
    // or if some conditions aren't met. This catch is to prevent app crash.
    // If analytics is crucial, further investigation on the specific error 'e' would be needed.
  }
}

// Exporting renamed instances to avoid potential naming conflicts with firebase module itself in some contexts
export { app, authInstance as auth, dbInstance as db, analyticsInstance as analytics };
