
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
      setUserProfile(null); // Reset profile on error
    }
  }, []);


  useEffect(() => {
    console.log("%cAuthContext: useEffect for onAuthStateChanged REGISTERING.", "color: green;");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log(`%cAuthContext: onAuthStateChanged FIRED. currentUser: ${currentUser ? currentUser.uid : 'null'}`, "color: green; font-weight: bold;");
      
      if (currentUser) {
        setUser(currentUser); // Set user immediately
        await fetchUserProfileCallback(currentUser.uid); // Fetch profile
        console.log(`%cAuthContext: User ${currentUser.uid} detected and profile fetch attempt complete. Setting loading = false.`, "color: green;");
      } else {
        setUser(null);
        setUserProfile(null);
        console.log("%cAuthContext: No currentUser from onAuthStateChanged. User and profile set to null. Setting loading = false.", "color: green;");
      }
      setLoading(false); // Set loading to false after initial check and potential profile fetch
    });

    return () => {
      console.log("%cAuthContext: Unsubscribing from onAuthStateChanged.", "color: green;");
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
  return context;
};

