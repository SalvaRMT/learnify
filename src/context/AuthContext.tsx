
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
  fetchUserAppData: (uid: string) => Promise<void>; // Ya no es necesario llamarla externamente
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
      setLoading(false); // Asegurarse de que loading termine si no hay UID
      return;
    }

    // setLoading(true); // No es necesario aquí si el loading principal ya está activo o se maneja en onAuthStateChanged

    try {
      // Leer perfil directamente
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
        fetchedProfileData.age = data.age === undefined || data.age === null || data.age === '' ? '' : Number(data.age);
        setUserProfile(fetchedProfileData);
        console.log(`%cAuthContext: Profile found for ${uid}:`, "color: blue;", fetchedProfileData);
      } else {
        // Este log ahora es más informativo si la creación automática falló por permisos.
        // El intento de creación ya ocurrió en onAuthStateChanged.
        console.warn(`%cAuthContext: Profile document NOT found in Firestore for UID: ${uid} after check/creation attempt.`, "color: red; font-weight: bold;");
        setUserProfile(null);
      }

      // Leer datos de racha
      const fetchedStreakDataResult = await getStudyStreakData(uid);
      setStreakData(fetchedStreakDataResult);
      console.log(`%cAuthContext: Streak data fetched for ${uid}:`, "color: blue;", fetchedStreakDataResult);

    } catch (error: any) {
      console.error(`%cAuthContext: Error en fetchUserAppDataCallback for ${uid}:`, "color: red;", error);
      if (error.code === 'permission-denied' || error.message?.includes("permission-denied") || error.message?.includes("permisos")) {
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
            `6. CONSEJO EXTRA: Utiliza el "Simulador de Reglas" en la pestaña 'Rules' de Firestore para probar tus reglas con el UID '${uid}'.\n\n`+
            `**ESTE MENSAJE ES UN DIAGNÓSTICO DE LA APLICACIÓN. LA SOLUCIÓN REQUIERE QUE ACTUALICES TUS REGLAS DE SEGURIDAD EN LA CONSOLA DE FIREBASE.**\n\n`+
            `Error original de Firestore reportado: "${error.message}" (Código: ${error.code})\n\n`,
            "background: red; color: white; font-size: 16px; font-weight: bold; padding: 10px; border: 3px solid darkred; line-height: 1.5;"
          );
        }
      setUserProfile(null); // Si hay error, perfil es null
      setStreakData(null);  // Si hay error, racha es null
    } finally {
      // setLoading(false); // Se maneja en onAuthStateChanged después de llamar a esta función
    }
  }, []); // Dependencias vacías, uid se pasa como argumento.

  const handleLoginSuccessCallback = useCallback(async (firebaseUser: FirebaseUser) => {
    console.log(`%cAuthContext: handleLoginSuccessCallback for ${firebaseUser.uid}. Current loading: ${loading}`, "color: green; font-weight: bold;");
    setUser(firebaseUser); 
    // setLoading(true); // No establecer loading aquí, se maneja en onAuthStateChanged
    // onAuthStateChanged se disparará y manejará la carga de datos y el estado de 'loading'
  }, [loading]); // Incluir loading si se usa para tomar decisiones

  useEffect(() => {
    console.log(`%cAuthContext useEffect[onAuthStateChanged]: Subscribing. Initial loading state: ${loading}`, "color: magenta;");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(`%cAuthContext onAuthStateChanged: FIRED. FirebaseUser: ${firebaseUser ? firebaseUser.uid : 'null'}`, "color: teal; font-weight: bold;");
      if (firebaseUser) {
        setLoading(true); // Poner loading a true MIENTRAS se cargan los datos de la app
        setUser(firebaseUser); // Actualiza el usuario inmediatamente

        // Verificar y crear perfil si no existe
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
              authProvider: firebaseUser.providerData?.[0]?.providerId || "password", // 'password' for email/pass
            });
            console.log(`%cAuthContext: Profile CREATED automatically in Firestore for UID: ${firebaseUser.uid}`, "color: green; font-weight: bold;");
          } else {
            console.log(`%cAuthContext: Profile already exists for UID: ${firebaseUser.uid}.`, "color: green;");
          }
        } catch (error: any) {
            // ESTE ERROR ES CRÍTICO SI LA CREACIÓN FALLA. PUEDE SER POR PERMISOS DE ESCRITURA.
            console.error(`%cAuthContext: FAILED to check/create profile for UID: ${firebaseUser.uid}. Error: ${error.message}. VERIFICA REGLAS DE 'create' EN '/users/{userId}'`, "color: red; font-weight: bold; font-size: 14px;");
        }

        await fetchUserAppDataCallback(firebaseUser.uid);
        console.log(`%cAuthContext onAuthStateChanged: User ${firebaseUser.uid} processed. Setting loading to false.`, "color: teal;");
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
  }, [fetchUserAppDataCallback]); // fetchUserAppDataCallback está envuelta en useCallback con []

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
      fetchUserAppData: fetchUserAppDataCallback, // Aunque no se llame externamente, la mantenemos por consistencia
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

    