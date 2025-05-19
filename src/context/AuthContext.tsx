
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { auth, db, firebaseConfig } from '@/lib/firebaseConfig'; // Import firebaseConfig
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
  const [loading, setLoading] = useState(true); 

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
          // =========================================================================================
          // ESTE MENSAJE DE CONSOLA ES UN DIAGNÓSTICO. INDICA QUE LAS REGLAS DE SEGURIDAD DE FIRESTORE SON INCORRECTAS.
          // LA SOLUCIÓN ES ARREGLAR LAS REGLAS EN LA CONSOLA DE FIREBASE, NO EN ESTE CÓDIGO.
          // VE A TU CONSOLA DE FIREBASE -> Firestore Database -> Rules
          // Y ASEGÚRATE DE TENER: match /users/{userId} { allow read: if request.auth.uid == userId; }
          // =========================================================================================
          const projectIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
          const projectIdFromConfigHardcoded = firebaseConfig.projectId; 
          const finalProjectId = projectIdFromEnv || projectIdFromConfigHardcoded || "DESCONOCIDO (¡CONFIGURAR projectId!)";

          console.error(
            `%c\n\n🔥🔥🔥 ALERTA CRÍTICA DE PERMISOS DE FIRESTORE (Proyecto: ${finalProjectId}) 🔥🔥🔥\n\n` +
            `La aplicación NO PUEDE LEER el perfil para el usuario UID: ${uid}\n` +
            `MOTIVO: Tus REGLAS DE SEGURIDAD de Firestore son INCORRECTAS o no se han propagado correctamente.\n\n` +
            `ACCIÓN REQUERIDA (EN LA CONSOLA DE FIREBASE):\n` +
            `1. Ve a tu proyecto de Firebase: ${finalProjectId}\n` +
            `2. Navega a: Firestore Database -> Pestaña 'Rules'. (URL: https://console.firebase.google.com/project/${finalProjectId}/firestore/rules)\n` +
            `3. ASEGÚRATE de que la regla para leer documentos en '/users/{userId}' sea EXACTAMENTE:\n` +
            `   match /users/{userId} {\n` +
            `     allow read: if request.auth.uid == userId;\n` +
            `     // ... también necesitarás 'allow create', 'allow update' para otras operaciones ...\n` +
            `   }\n` +
            `4. ¡HAZ CLIC EN "PUBLICAR" DESPUÉS DE CAMBIAR LAS REGLAS!\n` +
            `5. Espera 1-2 minutos para la propagación y REINICIA tu servidor de desarrollo.\n\n`+
            `**ESTE PROBLEMA NO SE PUEDE ARREGLAR CAMBIANDO EL CÓDIGO DE LA APLICACIÓN. La corrección está en la configuración de Firebase.**\n\n`+
            `Error original de Firestore reportado por la acción getUserProfile: "${profileResult.error}"\n\n`,
            "background: red; color: white; font-size: 16px; font-weight: bold; padding: 10px; border: 3px solid darkred; line-height: 1.5;"
          );
        }
        setUserProfile(null); 
      }
      
      setStreakData(fetchedStreakDataResult);
      console.log(`%cAuthContext: Streak data fetched for ${uid}:`, "color: blue;", fetchedStreakDataResult);

    } catch (error) {
      console.error(`%cAuthContext: Error en fetchUserAppDataCallback for ${uid}:`, "color: red;", error);
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
      } catch (error) {
        console.error(`%cAuthContext: Error during refreshUserAppDataCallback for ${user.uid}:`, "color: red;", error);
      } finally {
        setLoading(false); 
        console.log(`%cAuthContext: refreshUserAppDataCallback finished for UID: ${user.uid}. Loading set to false.`, "color: purple;");
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
        // setLoading(true) is handled by fetchUserAppDataCallback if needed, or by initial state.
        // The main setLoading(true) for initial load is outside this if/else.
        // We ensure loading is true before any async data fetching starts based on new auth state.
        if (!loading && !userProfile) { // If we weren't loading but now have a user and no profile, start loading sequence
            setLoading(true);
        }
        try {
            await fetchUserAppDataCallback(firebaseUser.uid);
        } finally {
            // setLoading(false) will be called inside fetchUserAppDataCallback's finally block
            // or if already false and no user, it stays false.
            // This ensures loading is only false after all data fetching related to this auth change is done.
            console.log(`%cAuthContext onAuthStateChanged: User ${firebaseUser.uid} processed. Loading state will be managed by fetchUserAppDataCallback.`, "color: teal;");
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setStreakData(null);
        setLoading(false); 
        console.log("%cAuthContext onAuthStateChanged: No FirebaseUser. User, profile, streak set to null. Loading set to false.", "color: red;");
      }
    });

    // Set loading to false after initial check if no user was found and not already loading
    // This handles the case where the app loads and the user is already logged out.
    if (!user && loading) {
      setLoading(false);
      console.log("%cAuthContext useEffect[onAuthStateChanged]: Initial auth check complete, no user, setting loading to false.", "color: magenta;");
    }


    return () => {
      console.log("%cAuthContext useEffect[onAuthStateChanged]: Unsubscribing.", "color: magenta;");
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUserAppDataCallback]); // Dependencies: only fetchUserAppDataCallback is stable. user/loading/userProfile are managed internally.

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile, 
      streakData, 
      loading, 
      fetchUserAppData: fetchUserAppDataCallback, 
      refreshUserAppData: refreshUserAppDataCallback, 
      handleLoginSuccess: handleLoginSuccessCallback 
    }}>
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
    
