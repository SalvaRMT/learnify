
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { auth, db } from '@/lib/firebaseConfig'; // Ensure db is imported if used here, e.g. in fetchUserProfile
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
  const [loading, setLoading] = useState(true); // Initialize loading to true

  console.log("AuthProvider: Initializing or re-rendering. Initial loading state:", loading, "User:", user?.uid);

  const fetchUserProfileCallback = useCallback(async (uid: string) => {
    console.log("AuthContext: fetchUserProfileCallback called for UID:", uid);
    // setLoading(true); // Optionally set loading true if this is a longer operation triggered independently
    try {
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        console.log("AuthContext: Profile found:", userDocSnap.data());
        setUserProfile(userDocSnap.data() as UserProfile);
      } else {
        console.log("AuthContext: Profile not found for UID:", uid);
        setUserProfile(null);
      }
    } catch (error) {
      console.error("AuthContext: Error fetching user profile:", error);
      setUserProfile(null);
    }
    // setLoading(false); // Do not set loading false here if onAuthStateChanged handles the primary loading state
  }, []);


  useEffect(() => {
    console.log("AuthContext: useEffect for onAuthStateChanged is running.");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log(`%cAuthContext: onAuthStateChanged triggered. currentUser: ${currentUser ? currentUser.uid : null}`, "color: blue; font-weight: bold;");
      
      if (currentUser) {
        setUser(currentUser);
        await fetchUserProfileCallback(currentUser.uid); // Fetch profile
        console.log(`%cAuthContext: User authenticated and profile fetched. Setting loading to false. User: ${currentUser.uid}`, "color: green; font-weight: bold;");
        setLoading(false); // Set loading to false after user is set and profile is fetched
      } else {
        setUser(null);
        setUserProfile(null);
        console.log(`%cAuthContext: No currentUser. Setting loading to false.`, "color: red; font-weight: bold;");
        setLoading(false); // No user, so not loading
      }
    });

    return () => {
      console.log("AuthContext: Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  }, [fetchUserProfileCallback]);

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
  // console.log("useAuth hook: Current context values - User:", context.user?.uid, "Loading:", context.loading, "Profile:", context.userProfile);
  return context;
};
