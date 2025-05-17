
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { auth, db } from '@/lib/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, Timestamp } from "firebase/firestore";

interface UserProfile {
  fullName?: string;
  age?: number;
  gender?: string;
  practiceTime?: number;
  createdAt?: Timestamp | Date;
  lastLoginAt?: Timestamp | Date;
  authProvider?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  fetchUserProfile: (uid: string) => Promise<void>;
  handleLoginSuccess: (firebaseUser: FirebaseUser) => Promise<void>; // New function
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true); // Start with loading true

  console.log(`%cAuthProvider: Render/Re-render. Loading: ${loading}, User: ${user ? user.uid : 'null'}`, "color: orange;");

  const fetchUserProfileCallback = useCallback(async (uid: string) => {
    console.log(`%cAuthContext: fetchUserProfileCallback called for UID: ${uid}`, "color: blue;");
    if (!uid) {
      console.warn("%cAuthContext: fetchUserProfileCallback called with no UID.", "color: yellow;");
      setUserProfile(null);
      return;
    }
    try {
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const profileData = userDocSnap.data() as UserProfile;
        console.log(`%cAuthContext: Profile found for ${uid}:`, "color: blue;", profileData);
        setUserProfile(profileData);
      } else {
        console.warn(`%cAuthContext: Profile NOT found for UID: ${uid}`, "color: yellow;");
        setUserProfile(null);
      }
    } catch (error) {
      console.error(`%cAuthContext: Error fetching user profile for ${uid}:`, "color: red;", error);
      setUserProfile(null);
    }
  }, []);

  const handleLoginSuccessCallback = useCallback(async (firebaseUser: FirebaseUser) => {
    console.log(`%cAuthContext: handleLoginSuccessCallback for ${firebaseUser.uid}`, "color: green; font-weight: bold;");
    setLoading(true); // Indicate we are processing login
    setUser(firebaseUser);
    await fetchUserProfileCallback(firebaseUser.uid);
    setLoading(false);
    console.log(`%cAuthContext: handleLoginSuccessCallback complete for ${firebaseUser.uid}. Loading is now false.`, "color: green; font-weight: bold;");
  }, [fetchUserProfileCallback]);

  useEffect(() => {
    console.log(`%cAuthContext useEffect: Subscribing to onAuthStateChanged. Initial loading state: ${loading}`, "color: orange;");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(`%cAuthContext onAuthStateChanged: FIRED. currentUser from Firebase: ${firebaseUser ? firebaseUser.uid : 'null'}`, "color: green; font-weight: bold;");
      
      if (firebaseUser) {
        // If handleLoginSuccessCallback has already set the user, 
        // this might be redundant but ensures consistency for external changes or initial load.
        if (user?.uid !== firebaseUser.uid) { // Only if user is different or not yet set by handleLoginSuccess
            setLoading(true); // Set loading true while we process
            setUser(firebaseUser);
            await fetchUserProfileCallback(firebaseUser.uid);
            setLoading(false); // Done processing
            console.log(`%cAuthContext onAuthStateChanged: User ${firebaseUser.uid} processed, profile fetch attempted. Loading set to false.`, "color: green;");
        } else if (loading && user?.uid === firebaseUser.uid) {
            // This handles the case where onAuthStateChanged fires for an already "logged in" user (e.g. page refresh)
            // but handleLoginSuccessCallback wasn't called.
            // We might still be in the initial loading phase.
            console.log(`%cAuthContext onAuthStateChanged: User ${firebaseUser.uid} already set, ensuring profile is fetched if still loading.`, "color: green;");
            await fetchUserProfileCallback(firebaseUser.uid); // Ensure profile is fetched
            setLoading(false);
            console.log(`%cAuthContext onAuthStateChanged: Profile fetch for existing user ${firebaseUser.uid} complete. Loading set to false.`, "color: green;");
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false); 
        console.log("%cAuthContext onAuthStateChanged: No currentUser. User and profile set to null. Loading set to false.", "color: red;");
      }
    });

    return () => {
      console.log("%cAuthContext useEffect: Unsubscribing from onAuthStateChanged.", "color: orange;");
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [fetchUserProfileCallback]); // user dependency removed to avoid loop with setUser in onAuthStateChanged if not careful

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, fetchUserProfile: fetchUserProfileCallback, handleLoginSuccess: handleLoginSuccessCallback }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
