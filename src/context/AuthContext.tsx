
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { auth } from '@/lib/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserProfile, getStudyStreakData } from "@/lib/actions";
import type { UserProfile, StreakData } from "@/types"; // Import from new types file

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  streakData: StreakData | null; // Add streakData
  loading: boolean;
  fetchUserAppData: (uid: string) => Promise<void>;
  refreshUserAppData: () => Promise<void>; // New function to refresh data
  handleLoginSuccess: (firebaseUser: FirebaseUser) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [streakData, setStreakData] = useState<StreakData | null>(null); // Initialize streakData
  const [loading, setLoading] = useState(true);

  console.log(`%cAuthProvider: Render/Re-render. Loading: ${loading}, User: ${user ? user.uid : 'null'}, Profile: ${userProfile ? 'loaded' : 'null'}, Streak: ${streakData ? 'loaded' : 'null'}`, "color: orange;");

  const fetchUserAppDataCallback = useCallback(async (uid: string) => {
    console.log(`%cAuthContext: fetchUserAppDataCallback called for UID: ${uid}`, "color: blue;");
    if (!uid) {
      console.warn("%cAuthContext: fetchUserAppDataCallback called with no UID.", "color: yellow;");
      setUserProfile(null);
      setStreakData(null);
      setLoading(false); // Ensure loading is false if no UID
      return;
    }
    
    // setLoading(true); // Set loading true when starting to fetch data
    try {
      const [profileResult, fetchedStreakData] = await Promise.all([
        getUserProfile(uid),
        getStudyStreakData(uid)
      ]);

      if (profileResult.success && profileResult.data) {
        console.log(`%cAuthContext: Profile found for ${uid}:`, "color: blue;", profileResult.data);
        setUserProfile(profileResult.data);
      } else {
        console.warn(`%cAuthContext: Profile NOT found or error for UID: ${uid}. Error: ${profileResult.error}`, "color: yellow;");
        setUserProfile(null);
      }
      
      setStreakData(fetchedStreakData); // Set streak data
      console.log(`%cAuthContext: Streak data fetched for ${uid}:`, "color: blue;", fetchedStreakData);

    } catch (error) {
      console.error(`%cAuthContext: Error in fetchUserAppDataCallback for ${uid}:`, "color: red;", error);
      setUserProfile(null);
      setStreakData(null);
    } 
    // finally {
    //   setLoading(false); // Set loading false after all fetches are done
    // }
  }, []);

  const refreshUserAppDataCallback = useCallback(async () => {
    if (user) {
      console.log(`%cAuthContext: refreshUserAppDataCallback called for UID: ${user.uid}`, "color: purple;");
      setLoading(true); // Indicate loading
      await fetchUserAppDataCallback(user.uid);
      setLoading(false); // Done loading
    } else {
      console.warn("%cAuthContext: refreshUserAppDataCallback called but no user is logged in.", "color: yellow;");
    }
  }, [user, fetchUserAppDataCallback]);

  const handleLoginSuccessCallback = useCallback(async (firebaseUser: FirebaseUser) => {
    console.log(`%cAuthContext: handleLoginSuccessCallback for ${firebaseUser.uid}`, "color: green; font-weight: bold;");
    setLoading(true); 
    setUser(firebaseUser);
    await fetchUserAppDataCallback(firebaseUser.uid);
    setLoading(false);
    console.log(`%cAuthContext: handleLoginSuccessCallback complete for ${firebaseUser.uid}. Loading is now false.`, "color: green; font-weight: bold;");
  }, [fetchUserAppDataCallback]);

  useEffect(() => {
    console.log(`%cAuthContext useEffect[onAuthStateChanged]: Subscribing. Initial loading: ${loading}`, "color: magenta;");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(`%cAuthContext onAuthStateChanged: FIRED. FirebaseUser: ${firebaseUser ? firebaseUser.uid : 'null'}`, "color: teal; font-weight: bold;");
      if (firebaseUser) {
        if (user?.uid !== firebaseUser.uid || !userProfile || !streakData) { // Fetch if user changed or data is missing
            setLoading(true);
            setUser(firebaseUser);
            await fetchUserAppDataCallback(firebaseUser.uid);
            setLoading(false); 
            console.log(`%cAuthContext onAuthStateChanged: User ${firebaseUser.uid} processed. Loading set to false.`, "color: teal;");
        } else if (loading) { // If already loading for this user, ensure it completes
            setLoading(false);
            console.log(`%cAuthContext onAuthStateChanged: Was loading for ${firebaseUser.uid}, set loading to false.`, "color: teal;");
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setStreakData(null);
        setLoading(false); 
        console.log("%cAuthContext onAuthStateChanged: No FirebaseUser. User, profile, streak set to null. Loading set to false.", "color: red;");
      }
    });

    return () => {
      console.log("%cAuthContext useEffect[onAuthStateChanged]: Unsubscribing.", "color: magenta;");
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fetchUserAppDataCallback removed from deps to avoid potential loops if not careful, but keep user for re-triggering login


  return (
    <AuthContext.Provider value={{ user, userProfile, streakData, loading, fetchUserAppData: fetchUserAppDataCallback, refreshUserAppData: refreshUserAppDataCallback, handleLoginSuccess: handleLoginSuccessCallback }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};

    