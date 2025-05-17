
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { auth, db } from '@/lib/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from "firebase/firestore";

interface UserProfile {
  fullName?: string;
  age?: number;
  gender?: string;
  practiceTime?: number;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  fetchUserProfile: (uid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true); // Start with loading true

  console.log(`%cAuthProvider: Render/Re-render. Loading: ${loading}, User: ${user ? user.uid : 'null'}`, "color: orange;");

  const fetchUserProfileCallback = useCallback(async (uid: string) => {
    console.log(`%cAuthContext: fetchUserProfileCallback called for UID: ${uid}`, "color: blue;");
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


  useEffect(() => {
    console.log(`%cAuthContext useEffect: Subscribing to onAuthStateChanged. Initial loading state: ${loading}`, "color: orange;");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log(`%cAuthContext onAuthStateChanged: FIRED. currentUser: ${currentUser ? currentUser.uid : 'null'}`, "color: green; font-weight: bold;");
      
      if (currentUser) {
        setUser(currentUser); // Set user immediately
        await fetchUserProfileCallback(currentUser.uid); // Fetch profile
        console.log(`%cAuthContext onAuthStateChanged: User ${currentUser.uid} processed, profile fetch attempted.`, "color: green;");
      } else {
        setUser(null);
        setUserProfile(null);
        console.log("%cAuthContext onAuthStateChanged: No currentUser. User and profile set to null.", "color: green;");
      }
      // This ensures loading is set to false only after the first auth state check is complete
      // and any associated user data fetching (like profile) is attempted.
      setLoading(false); 
      console.log(`%cAuthContext onAuthStateChanged: Setting loading to false. Final user state: ${currentUser ? currentUser.uid : 'null'}`, "color: blue; font-weight: bold;");
    });

    return () => {
      console.log("%cAuthContext useEffect: Unsubscribing from onAuthStateChanged.", "color: orange;");
      unsubscribe();
    };
  }, [fetchUserProfileCallback]); // fetchUserProfileCallback is memoized with useCallback

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, fetchUserProfile: fetchUserProfileCallback }}>
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
