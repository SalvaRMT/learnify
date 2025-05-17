
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
  const [loading, setLoading] = useState(true); 

  console.log(`%cAuthProvider: Render/Re-render. Loading: ${loading}, User: ${user ? user.uid : null}`, "color: orange;");

  const fetchUserProfileCallback = useCallback(async (uid: string) => {
    console.log(`%cAuthContext: fetchUserProfileCallback called for UID: ${uid}`, "color: blue;");
    try {
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        console.log(`%cAuthContext: Profile found for ${uid}:`, "color: blue;", userDocSnap.data());
        setUserProfile(userDocSnap.data() as UserProfile);
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
    console.log("%cAuthContext: useEffect for onAuthStateChanged REGISTERED.", "color: green;");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log(`%cAuthContext: onAuthStateChanged FIRED. currentUser: ${currentUser ? currentUser.uid : 'null'}`, "color: green; font-weight: bold;");
      
      if (currentUser) {
        console.log(`%cAuthContext: currentUser detected (${currentUser.uid}). Setting loading = true.`, "color: green;");
        setLoading(true); 
        setUser(currentUser);
        await fetchUserProfileCallback(currentUser.uid);
        console.log(`%cAuthContext: Profile fetch complete for ${currentUser.uid}. Setting loading = false.`, "color: green;");
        setLoading(false);
      } else {
        console.log("%cAuthContext: No currentUser from onAuthStateChanged. Setting user to null, profile to null, loading = false.", "color: green;");
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
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
  // console.log("useAuth hook: Current context values - User:", context.user?.uid, "Loading:", context.loading, "Profile:", context.userProfile);
  return context;
};
