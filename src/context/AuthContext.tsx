
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { auth, db, firebaseConfig } from '@/lib/firebaseConfig'; // Import firebaseConfig
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
// getUserProfile ya no se llama desde aquí, getStudyStreakData sí.
import { getStudyStreakData } from "@/lib/actions"; 
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
      // setLoading(false); // No establecer loading aquí, se maneja en el вызывающем onAuthStateChanged
      return;
    }

    try {
      // Leer perfil directamente desde el cliente
      const userDocRef = doc(db, "users", uid);
      const profileSnap = await getDoc(userDocRef);
      let fetchedProfileData: UserProfile | null = null;

      if (profileSnap.exists()) {
        const data = profileSnap.data();
        fetchedProfileData = { ...data, uid } as UserProfile;
        if (data.createdAt && data.createdAt instanceof Timestamp) {
          fetchedProfileData.createdAt = data.createdAt.toDate();
        }
        if (data.lastLoginAt && data.lastLoginAt instanceof Timestamp) {
          fetchedProfileData.lastLoginAt = data.lastLoginAt.toDate();
        }
        // Asegurar que age sea número o string vacío, y gender string o vacío.
        fetchedProfileData.age = data.age === undefined || data.age === null ? '' : Number(data.age);
        fetchedProfileData.gender = data.gender === undefined || data.gender === null ? '' : String(data.gender);

        setUserProfile(fetchedProfileData);
        console.log(`%cAuthContext: Profile found for ${uid}:`, "color: blue;", fetchedProfileData);
      } else {
        // Este log es informativo. La creación del perfil ocurre en onAuthStateChanged si no existe.
        console.warn(`%cAuthContext: Profile document NOT found in Firestore for UID: ${uid} during fetchUserAppData.`, "color: orange;");
        setUserProfile(null);
      }

      const fetchedStreakDataResult = await getStudyStreakData(uid);
      setStreakData(fetchedStreakDataResult);
      console.log(`%cAuthContext: Streak data fetched for ${uid}:`, "color: blue;", fetchedStreakDataResult);

    } catch (error: any) {
      console.error(`%cAuthContext: Error en fetchUserAppDataCallback for ${uid}:`, "color: red;", error);
      const profileResultError = error.message || "Error desconocido al obtener perfil.";
      
      if (profileResultError.includes("permission-denied") || profileResultError.includes("permisos") || profileResultError.includes("Missing or insufficient permissions")) {
          const projectIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
          const projectIdFromConfigHardcoded = firebaseConfig.projectId; 
          const finalProjectId = projectIdFromEnv || projectIdFromConfigHardcoded || "DESCONOCIDO (¡CONFIGURAR projectId!)";
          
          // =========================================================================================
          // ESTE MENSAJE DE CONSOLA ES UN DIAGNÓSTICO. INDICA QUE LAS REGLAS DE SEGURIDAD DE FIRESTORE SON INCORRECTAS.
          // LA SOLUCIÓN ES ARREGLAR LAS REGLAS EN LA CONSOLA DE FIREBASE, NO EN ESTE CÓDIGO.
          // =========================================================================================
          console.error(
            `%c\n\n🔥🔥🔥 ALERTA CRÍTICA DE PERMISOS DE FIRESTORE (Proyecto: ${finalProjectId}) 🔥🔥🔥\n\n` +
            `La aplicación NO PUEDE LEER el perfil para el usuario UID: ${uid}\n` +
            `MOTIVO: Tus REGLAS DE SEGURIDAD de Firestore son INCORRECTAS o no se han propagado correctamente.\n\n` +
            `ACCIÓN REQUERIDA (EN LA CONSOLA DE FIREBASE):\n` +
            `1. Ve a tu proyecto de Firebase: ${finalProjectId}\n` +
            `2. Navega a: Firestore Database -> Pestaña 'Rules'. (URL: https://console.firebase.google.com/project/${finalProjectId}/firestore/rules)\n` +
            `3. ASEGÚRATE de que la regla para leer documentos en '/users/{userId}' sea EXACTAMENTE (copia y pega con cuidado):\n` +
            `   match /users/{userId} {\n` +
            `     allow read: if request.auth.uid == userId;\n` +
            `     // ... también necesitarás 'allow create', 'allow update' para otras operaciones ...\n` +
            `   }\n` +
            `4. ¡HAZ CLIC EN "PUBLICAR" DESPUÉS DE CAMBIAR LAS REGLAS!\n` +
            `5. Espera 1-2 minutos para la propagación y REINICIA tu servidor de desarrollo.\n` +
            `6. CONSEJO EXTRA: Utiliza el "Simulador de Reglas" en la pestaña 'Rules' de Firestore para probar tus reglas con el UID '${uid}'.\n\n` +
            `**ESTE MENSAJE ES UN DIAGNÓSTICO DE LA APLICACIÓN. LA SOLUCIÓN REQUIERE QUE ACTUALICES TUS REGLAS DE SEGURIDAD EN LA CONSOLA DE FIREBASE.**\n\n` +
            `Error original de Firestore reportado: "${profileResultError}"\n\n`,
            "background: red; color: white; font-size: 14px; font-weight: bold; padding: 10px; border: 3px solid darkred; line-height: 1.5;"
          );
        }
      setUserProfile(null); 
      setStreakData(null);  
    }
  }, []); 

  const handleLoginSuccessCallback = useCallback(async (firebaseUser: FirebaseUser) => {
    console.log(`%cAuthContext: handleLoginSuccessCallback for ${firebaseUser.uid}. Current loading: ${loading}`, "color: green; font-weight: bold;");
    // No necesitamos setLoading(true) aquí si onAuthStateChanged lo va a manejar.
    // setUser(firebaseUser); // onAuthStateChanged lo hará
    // El estado del usuario y la carga de datos de la aplicación se manejarán en onAuthStateChanged
    // después de que el SDK de Firebase reconozca el inicio de sesión.
    // Si la autenticación fue en el cliente, onAuthStateChanged debería dispararse.
    // Si fue en el servidor y luego refrescamos, onAuthStateChanged debería dispararse.
    // Podríamos forzar una carga aquí si fuera necesario, pero probemos sin ella primero.
    await fetchUserAppDataCallback(firebaseUser.uid); // Carga proactiva de datos después del login
    console.log(`%cAuthContext: handleLoginSuccessCallback complete for ${firebaseUser.uid}. Loading is now ${loading}.`, "color: green;");

  }, [fetchUserAppDataCallback, loading]); 

  useEffect(() => {
    console.log(`%cAuthContext useEffect[onAuthStateChanged]: Subscribing. Initial loading: ${loading}`, "color: magenta;");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(`%cAuthContext onAuthStateChanged: FIRED. FirebaseUser: ${firebaseUser ? firebaseUser.uid : 'null'}`, "color: teal; font-weight: bold;");
      if (firebaseUser) {
        setLoading(true); 
        setUser(firebaseUser); 

        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (!docSnap.exists()) {
            console.log(`%cAuthContext: Profile NOT found for UID: ${firebaseUser.uid}. Attempting to create new profile...`, "color: orange; font-weight: bold;");
            await setDoc(userDocRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              fullName: firebaseUser.displayName || firebaseUser.email || "",
              createdAt: serverTimestamp(),
              practiceTime: 15, 
              age: null, 
              gender: null,
              authProvider: firebaseUser.providerData?.[0]?.providerId || "password",
            });
            console.log(`%cAuthContext: Profile CREATED automatically in Firestore for UID: ${firebaseUser.uid}`, "color: green; font-weight: bold;");
          } else {
            console.log(`%cAuthContext: Profile already exists for UID: ${firebaseUser.uid}.`, "color: green;");
          }
        } catch (error: any) {
            const projectIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
            const projectIdFromConfigHardcoded = firebaseConfig.projectId; 
            const finalProjectId = projectIdFromEnv || projectIdFromConfigHardcoded || "DESCONOCIDO";
            
            console.error(
              `%c\n\n🆘🆘🆘 ALERTA CRÍTICA DE PERMISOS DE FIRESTORE (Proyecto: ${finalProjectId}) 🆘🆘🆘\n\n` +
              `AuthContext: FALLÓ al verificar/crear el perfil para UID: ${firebaseUser.uid} en onAuthStateChanged.\n` +
              `ERROR: ${error.message}\n\n` +
              `CAUSA MÁS PROBABLE: Tus REGLAS DE SEGURIDAD de Firestore NO PERMITEN:\n` +
              `  1. LEER ('get') el documento '/users/${firebaseUser.uid}' (para verificar si existe).\n` +
              `  O\n` +
              `  2. CREAR ('create') el documento '/users/${firebaseUser.uid}' (si no existía).\n\n` +
              `ACCIÓN REQUERIDA (EN LA CONSOLA DE FIREBASE -> Firestore Database -> Rules):\n` +
              `Asegúrate de tener reglas como:\n` +
              `  match /users/{userId} {\n` +
              `    allow read: if request.auth.uid == userId;\n` +
              `    allow create: if request.auth.uid == userId; // Y que el ID del doc sea el UID del usuario\n` +
              `    // ... (otras reglas: update, delete)\n` +
              `  }\n` +
              `URL: https://console.firebase.google.com/project/${finalProjectId}/firestore/rules\n\n` +
              `**LA APLICACIÓN NO FUNCIONARÁ CORRECTAMENTE HASTA QUE ESTOS PERMISOS SE CORRIJAN EN FIREBASE.**\n\n`,
              "background: red; color: white; font-size: 14px; font-weight: bold; padding: 10px; border: 3px solid darkred; line-height: 1.5;"
            );
        }

        await fetchUserAppDataCallback(firebaseUser.uid);
        console.log(`%cAuthContext onAuthStateChanged: User ${firebaseUser.uid} processed. Loading set to false.`, "color: teal;");
        setLoading(false); 
      } else {
        setUser(null);
        setUserProfile(null);
        setStreakData(null);
        console.log("%cAuthContext onAuthStateChanged: No FirebaseUser. User, profile, streak set to null. Loading set to false.", "color: red;");
        setLoading(false); 
      }
    });

    return () => {
      console.log("%cAuthContext useEffect[onAuthStateChanged]: Unsubscribing.", "color: magenta;");
      unsubscribe();
    };
  }, [fetchUserAppDataCallback]); // fetchUserAppDataCallback tiene dependencias vacías

  const refreshUserAppDataCallback = useCallback(async () => {
    if (user) {
      console.log(`%cAuthContext: refreshUserAppDataCallback called for UID: ${user.uid}. Setting loading true.`, "color: purple;");
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
