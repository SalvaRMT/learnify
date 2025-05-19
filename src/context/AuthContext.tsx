
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { auth } from '@/lib/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserProfile, getStudyStreakData } from "@/lib/actions";
import type { UserProfile, StreakData } from "@/types";

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  streakData: StreakData | null;
  loading: boolean;
  fetchUserAppData: (uid: string) => Promise<void>;
  refreshUserAppData: () => Promise<void>;
  handleLoginSuccess: (firebaseUser: FirebaseUser) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true); // Initialize loading to true

  console.log(`%cAuthProvider: Render/Re-render. Loading: ${loading}, User: ${user ? user.uid : 'null'}, Profile: ${userProfile ? 'loaded' : 'null'}, Streak: ${streakData ? 'loaded' : 'null'}`, "color: orange;");

  const fetchUserAppDataCallback = useCallback(async (uid: string) => {
    console.log(`%cAuthContext: fetchUserAppDataCallback called for UID: ${uid}`, "color: blue;");
    if (!uid) {
      console.warn("%cAuthContext: fetchUserAppDataCallback called with no UID. Clearing user data.", "color: yellow;");
      setUserProfile(null);
      setStreakData(null);
      return;
    }
    
    try {
      const [profileResult, fetchedStreakDataResult] = await Promise.all([
        getUserProfile(uid),
        getStudyStreakData(uid)
      ]);

      if (profileResult.success && profileResult.data) {
        console.log(`%cAuthContext: Profile found for ${uid}:`, "color: blue;", profileResult.data);
        setUserProfile(profileResult.data);
      } else {
        console.warn(`%cAuthContext: Profile NOT found or error for UID: ${uid}. Error: ${profileResult.error}`, "color: red; font-weight: bold;");
        if (profileResult.error?.includes("permission-denied") || profileResult.error?.includes("permisos")) {
          // ESTE MENSAJE DE CONSOLA ES UN DIAGNÓSTICO. INDICA QUE LAS REGLAS DE SEGURIDAD DE FIRESTORE SON INCORRECTAS.
          // LA SOLUCIÓN ES ARREGLAR LAS REGLAS EN LA CONSOLA DE FIREBASE, NO EN ESTE CÓDIGO.
          // VE A TU CONSOLA DE FIREBASE -> Firestore Database -> Rules
          // Y ASEGÚRATE DE TENER: match /users/{userId} { allow read: if request.auth.uid == userId; }
          console.error(
            `%cALERTA CRÍTICA DE PERMISOS DE FIRESTORE: La aplicación NO PUEDE LEER el perfil para el usuario ${uid} porque tus REGLAS DE SEGURIDAD de Firestore son INCORRECTAS. ` +
            `POR FAVOR, ve a tu Consola de Firebase -> Firestore Database -> Pestaña 'Rules' y asegúrate de que la regla para leer documentos en '/users/{userId}' sea EXACTAMENTE: ` +
            `'allow read: if request.auth.uid == userId;'`,
            "background: red; color: white; font-size: 16px; font-weight: bold; padding: 8px; border: 2px solid darkred;"
          );
        }
        setUserProfile(null); // Asegura que userProfile es null si no se pudo cargar.
      }
      
      setStreakData(fetchedStreakDataResult); // Usa el resultado directamente
      console.log(`%cAuthContext: Streak data fetched for ${uid}:`, "color: blue;", fetchedStreakDataResult);

    } catch (error) {
      console.error(`%cAuthContext: Error in fetchUserAppDataCallback for ${uid}:`, "color: red;", error);
      setUserProfile(null);
      setStreakData(null);
    }
  }, []);

  const refreshUserAppDataCallback = useCallback(async () => {
    if (user) {
      console.log(`%cAuthContext: refreshUserAppDataCallback called for UID: ${user.uid}`, "color: purple;");
      setLoading(true); 
      try {
        await fetchUserAppDataCallback(user.uid);
      } finally {
        setLoading(false); 
      }
    } else {
      console.warn("%cAuthContext: refreshUserAppDataCallback called but no user is logged in.", "color: yellow;");
    }
  }, [user, fetchUserAppDataCallback]);

  const handleLoginSuccessCallback = useCallback(async (firebaseUser: FirebaseUser) => {
    console.log(`%cAuthContext: handleLoginSuccessCallback for ${firebaseUser.uid}`, "color: green; font-weight: bold;");
    setLoading(true); 
    setUser(firebaseUser); 
    try {
      await fetchUserAppDataCallback(firebaseUser.uid); 
    } finally {
      setLoading(false);
      console.log(`%cAuthContext: handleLoginSuccessCallback complete for ${firebaseUser.uid}. Loading is now false.`, "color: green; font-weight: bold;");
    }
  }, [fetchUserAppDataCallback]);

  useEffect(() => {
    console.log(`%cAuthContext useEffect[onAuthStateChanged]: Subscribing. Initial loading: ${loading}`, "color: magenta;");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(`%cAuthContext onAuthStateChanged: FIRED. FirebaseUser: ${firebaseUser ? firebaseUser.uid : 'null'}`, "color: teal; font-weight: bold;");
      if (firebaseUser) {
        setUser(firebaseUser); 
        setLoading(true); // Set loading to true while fetching app data
        try {
          await fetchUserAppDataCallback(firebaseUser.uid);
        } finally {
          setLoading(false); 
          console.log(`%cAuthContext onAuthStateChanged: User ${firebaseUser.uid} processed. Loading set to false.`, "color: teal;");
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
  }, [fetchUserAppDataCallback]);


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
