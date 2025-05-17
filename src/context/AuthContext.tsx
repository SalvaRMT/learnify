
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth } from '@/lib/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

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
  const [loading, setLoading] = useState(true);

  // console.log("AuthProvider: Initializing or re-rendering. Initial loading state:", loading, "User:", user?.uid);

  const fetchUserProfile = async (uid: string) => {
    console.log("AuthContext: Fetching profile for UID:", uid);
    try {
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        // console.log("AuthContext: Profile found:", userDocSnap.data());
        setUserProfile(userDocSnap.data() as UserProfile);
      } else {
        // console.log("AuthContext: Profile not found for UID:", uid);
        setUserProfile(null);
      }
    } catch (error) {
      console.error("AuthContext: Error fetching user profile:", error);
      setUserProfile(null);
    }
  };

  useEffect(() => {
    // console.log("AuthContext: useEffect for onAuthStateChanged is running.");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log(`%cAuthContext: onAuthStateChanged triggered. currentUser: ${currentUser ? currentUser.uid : null}, Current loading state: ${loading}`, "color: blue; font-weight: bold;");
      setUser(currentUser);
      if (currentUser) {
        // console.log("AuthContext: currentUser exists, fetching profile.");
        await fetchUserProfile(currentUser.uid);
      } else {
        // console.log("AuthContext: currentUser is null, setting profile to null.");
        setUserProfile(null);
      }
      // console.log("AuthContext: Setting loading to false.");
      setLoading(false);
    });

    return () => {
      // console.log("AuthContext: Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, fetchUserProfile }}>
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

    