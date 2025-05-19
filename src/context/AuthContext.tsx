
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
      return;
    }

    let fetchedProfileData: UserProfile | null = null;
    let profileError: string | null = null;

    try {
      const userDocRef = doc(db, "users", uid);
      const profileSnap = await getDoc(userDocRef);

      if (profileSnap.exists()) {
        const data = profileSnap.data();
        fetchedProfileData = { ...data, uid } as UserProfile;
        if (data.createdAt && data.createdAt instanceof Timestamp) {
          fetchedProfileData.createdAt = data.createdAt.toDate();
        }
        if (data.lastLoginAt && data.lastLoginAt instanceof Timestamp) {
          fetchedProfileData.lastLoginAt = data.lastLoginAt.toDate();
        }
        fetchedProfileData.age = data.age === undefined || data.age === null ? '' : Number(data.age);
        fetchedProfileData.gender = data.gender === undefined || data.gender === null ? '' : String(data.gender);
        setUserProfile(fetchedProfileData);
        console.log(`%cAuthContext: Profile found for ${uid}:`, "color: blue;", fetchedProfileData);
      } else {
        console.warn(`%cAuthContext: Profile document NOT found in Firestore for UID: ${uid} during fetchUserAppData. This might be expected if it's a new user and profile creation failed or is pending.`, "color: orange;");
        setUserProfile(null); // Explicitly set to null if not found
      }
    } catch (error: any) {
      console.error(`%cAuthContext: Error fetching profile for UID ${uid} in fetchUserAppDataCallback:`, "color: red;", error);
      profileError = error.message || "Error desconocido al obtener perfil.";
      setUserProfile(null);
    }

    if (profileError) {
        const profileResultError = profileError; // Use the captured error
        console.warn(`%cAuthContext: Profile NOT found or error for UID: ${uid}. Error: ${profileResultError}`, "color: red; font-weight: bold;");
        if (profileResultError.includes("permission-denied") || profileResultError.includes("permisos") || profileResultError.includes("Missing or insufficient permissions")) {
          // ESTE MENSAJE DE CONSOLA ES UN DIAGNÓSTICO. INDICA QUE LAS REGLAS DE SEGURIDAD DE FIRESTORE SON INCORRECTAS.
          // LA SOLUCIÓN ES ARREGLAR LAS REGLAS EN LA CONSOLA DE FIREBASE, NO EN ESTE CÓDIGO.
          // =========================================================================================
          // VERIFICA QUE EL PROJECT ID COINCIDA CON EL PROYECTO DONDE ESTÁS EDITANDO LAS REGLAS
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
            `3. ASEGÚRATE de que la regla para leer documentos en '/users/{userId}' sea EXACTAMENTE (copia y pega con cuidado):\n` +
            `   match /users/{userId} {\n` +
            `     allow read: if request.auth.uid == userId;\n` +
            `     // ... también necesitarás 'allow create', 'allow update' para otras operaciones ...\n` +
            `   }\n` +
            `4. ¡HAZ CLIC EN "PUBLICAR" DESPUÉS DE CAMBIAR LAS REGLAS!\n` +
            `5. Espera 1-2 minutos para la propagación y REINICIA tu servidor de desarrollo.\n` +
            `6. CONSEJO EXTRA: Utiliza el "Simulador de Reglas" en la pestaña 'Rules' de Firestore para probar tus reglas con el UID '${uid}'.\n\n` +
            `**ESTE MENSAJE ES UN DIAGNÓSTICO DE LA APLICACIÓN. LA SOLUCIÓN REQUIERE QUE ACTUALICES TUS REGLAS DE SEGURIDAD EN LA CONSOLA DE FIREBASE.**\n\n` +
            `Error original de Firestore reportado por la acción getUserProfile: "${profileResultError}"\n\n`,
            "background: red; color: white; font-size: 12px; font-weight: bold; padding: 10px; border: 3px solid darkred; line-height: 1.5;"
          );
        }
    }

    try {
      const fetchedStreakDataResult = await getStudyStreakData(uid);
      setStreakData(fetchedStreakDataResult);
      console.log(`%cAuthContext: Streak data fetched for ${uid}:`, "color: blue;", fetchedStreakDataResult);
    } catch (error) {
      console.error(`%cAuthContext: Error fetching streak data for UID ${uid}:`, "color: red;", error);
      setStreakData(null); // O un estado de error/valor por defecto para streakData
    }
  }, []); 

  const handleLoginSuccessCallback = useCallback(async (firebaseUser: FirebaseUser) => {
    console.log(`%cAuthContext: handleLoginSuccessCallback for ${firebaseUser.uid}. Current loading: ${loading}`, "color: green; font-weight: bold;");
    setLoading(true); // Indicar que estamos cargando datos del usuario
    setUser(firebaseUser);
    try {
      await fetchUserAppDataCallback(firebaseUser.uid);
    } catch (error) {
       console.error(`%cAuthContext: Error en handleLoginSuccessCallback al llamar a fetchUserAppData:`, "color: red;", error);
    } finally {
      setLoading(false); 
      console.log(`%cAuthContext: handleLoginSuccessCallback complete for ${firebaseUser.uid}. Loading is now ${loading}.`, "color: green;");
    }
  }, [fetchUserAppDataCallback, loading]); // `loading` se añade como dependencia si su valor actual es relevante para la lógica interna de handleLoginSuccessCallback

  useEffect(() => {
    console.log(`%cAuthContext useEffect[onAuthStateChanged]: Subscribing. Initial loading: ${loading}`, "color: magenta;");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(`%cAuthContext onAuthStateChanged: FIRED. FirebaseUser: ${firebaseUser ? firebaseUser.uid : 'null'}`, "color: teal; font-weight: bold;");
      if (firebaseUser) {
        setLoading(true); // Comienza la carga en cuanto se detecta un usuario
        setUser(firebaseUser); 

        // Intentar crear perfil si no existe
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          const docSnap = await getDoc(userDocRef); // Requiere permiso de LECTURA
          if (!docSnap.exists()) {
            console.log(`%cAuthContext: Profile NOT found for UID: ${firebaseUser.uid}. Attempting to create new profile...`, "color: orange; font-weight: bold;");
            await setDoc(userDocRef, { // Requiere permiso de CREACIÓN
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
            // ESTE ERROR ES CRÍTICO SI LA CREACIÓN/VERIFICACIÓN FALLA. PUEDE SER POR PERMISOS DE LECTURA O ESCRITURA.
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
              "background: red; color: white; font-size: 12px; font-weight: bold; padding: 10px; border: 3px solid darkred; line-height: 1.5;"
            );
        }

        await fetchUserAppDataCallback(firebaseUser.uid); // Cargar perfil y datos de racha
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

    
