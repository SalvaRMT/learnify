
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { auth, db, firebaseConfig } from '@/lib/firebaseConfig'; // Import firebaseConfig
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
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
    
    let operationAttempted = "desconocida";
    let originalFirestoreError = "No especificado";

    try {
      // Fetch user profile directly from client
      operationAttempted = `getDoc (leer perfil) en /users/${uid}`;
      console.log(`%cAuthContext: ${operationAttempted}`, "color: blue;");
      const userDocRef = doc(db, "users", uid);
      const profileSnap = await getDoc(userDocRef);

      if (profileSnap.exists()) {
        const data = profileSnap.data();
        const fetchedProfileData: UserProfile = { 
          ...data, 
          uid,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined),
          lastLoginAt: data.lastLoginAt instanceof Timestamp ? data.lastLoginAt.toDate() : (data.lastLoginAt ? new Date(data.lastLoginAt) : undefined),
          age: data.age === undefined || data.age === null ? '' : Number(data.age),
          gender: data.gender === undefined || data.gender === null ? '' : String(data.gender),
        };
        setUserProfile(fetchedProfileData);
        console.log(`%cAuthContext: Profile found for ${uid}:`, "color: blue;", fetchedProfileData);
      } else {
        setUserProfile(null); // Explicitly set to null if not found
        console.warn(`%cAuthContext: Profile document NOT found in Firestore for UID: ${uid}.`, "color: orange;");
      }
    } catch (error: any) {
      originalFirestoreError = error.message || "Error desconocido al obtener perfil.";
      console.error(`%cAuthContext: Error fetching profile for UID ${uid} directly in AuthContext. Operation: ${operationAttempted}. Error: ${originalFirestoreError}`, "color: red;", error);
      
      // ESTE MENSAJE DE CONSOLA ES UN DIAGNÓSTICO. INDICA QUE LAS REGLAS DE SEGURIDAD DE FIRESTORE SON INCORRECTAS.
      // LA SOLUCIÓN ES ARREGLAR LAS REGLAS EN LA CONSOLA DE FIREBASE, NO EN ESTE CÓDIGO.
      // =========================================================================================
      // ¡¡¡ ATENCIÓN DESARROLLADOR: ESTE MENSAJE ES IMPORTANTE !!!
      // =========================================================================================
      if (originalFirestoreError.includes("permission-denied") || originalFirestoreError.includes("permisos") || originalFirestoreError.includes("Missing or insufficient permissions")) {
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
            `Error original de Firestore reportado al intentar leer el perfil desde AuthContext: "${originalFirestoreError}"\n\n`,
            "background: red; color: white; font-size: 12px; font-weight: bold; padding: 10px; border: 3px solid darkred; line-height: 1.5;"
          );
        }
      setUserProfile(null); // Si hay error al leer, el perfil es null
    }

    try {
      const fetchedStreakData = await getStudyStreakData(uid);
      setStreakData(fetchedStreakData);
      console.log(`%cAuthContext: Streak data fetched for ${uid}:`, "color: blue;", fetchedStreakData);
    } catch (error) {
      console.error(`%cAuthContext: Error fetching streak data for UID ${uid}:`, "color: red;", error);
      setStreakData(null);
    }
  }, []); 

  useEffect(() => {
    console.log(`%cAuthContext useEffect[onAuthStateChanged]: Subscribing. Initial loading: ${loading}`, "color: magenta;");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(`%cAuthContext onAuthStateChanged: FIRED. FirebaseUser: ${firebaseUser ? firebaseUser.uid : 'null'}`, "color: teal; font-weight: bold;");
      if (firebaseUser) {
        setUser(firebaseUser); 
        
        let operationAttempted = "getDoc (verificar perfil)";
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          console.log(`%cAuthContext: Attempting to GET profile from Firestore to check existence. Path: /users/${firebaseUser.uid}, UID: ${firebaseUser.uid}`, "color: blue;");
          const docSnap = await getDoc(userDocRef);
          
          if (!docSnap.exists()) {
            operationAttempted = `setDoc (crear perfil) en /users/${firebaseUser.uid}`;
            console.log(`%cAuthContext: Profile NOT found for UID: ${firebaseUser.uid}. Attempting to CREATE new profile...`, "color: orange; font-weight: bold;");
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
            const createProfileErrorMessage = error.message || "Error desconocido durante la verificación/creación del perfil.";
            const projectIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
            const projectIdFromConfigHardcoded = firebaseConfig.projectId; 
            const finalProjectId = projectIdFromEnv || projectIdFromConfigHardcoded || "DESCONOCIDO";
            
            console.error(
              `%c\n\n🆘🆘🆘 ALERTA CRÍTICA DE PERMISOS DE FIRESTORE (Proyecto: ${finalProjectId}) 🆘🆘🆘\n\n` +
              `AuthContext: FALLÓ al ${operationAttempted} para UID: ${firebaseUser.uid} en onAuthStateChanged.\n` +
              `ERROR: ${createProfileErrorMessage}\n\n` +
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
              "background: #FFD2D2; color: #D8000C; font-size: 12px; font-weight: bold; padding: 10px; border: 1px solid #D8000C; line-height: 1.5;"
            );
        }

        // Cargar datos de perfil y racha DESPUÉS de verificar/crear el perfil
        await fetchUserAppDataCallback(firebaseUser.uid);
        setLoading(false); 
        console.log(`%cAuthContext onAuthStateChanged: User ${firebaseUser.uid} processed. Loading set to false.`, "color: teal;");
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
  }, [fetchUserAppDataCallback]); // fetchUserAppDataCallback tiene dependencia vacía []

  const handleLoginSuccessCallback = useCallback(async (firebaseUser: FirebaseUser) => {
    console.log(`%cAuthContext: handleLoginSuccessCallback for ${firebaseUser.uid}.`, "color: green; font-weight: bold;");
    setLoading(true); // Indicar que estamos procesando el inicio de sesión
    setUser(firebaseUser); // Establecer el usuario inmediatamente
    
    // Aquí también, verificar/crear perfil antes de cargar todos los datos
    let operationAttempted = "getDoc (verificar perfil post-login)";
    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      console.log(`%cAuthContext (handleLoginSuccess): Attempting to GET profile. Path: /users/${firebaseUser.uid}`, "color: blue;");
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        operationAttempted = `setDoc (crear perfil post-login) en /users/${firebaseUser.uid}`;
        console.log(`%cAuthContext (handleLoginSuccess): Profile NOT found for UID: ${firebaseUser.uid}. Creating new profile...`, "color: orange; font-weight: bold;");
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
        console.log(`%cAuthContext (handleLoginSuccess): Profile CREATED for UID: ${firebaseUser.uid}`, "color: green; font-weight: bold;");
      }
    } catch (error: any) {
      // Manejo de error similar al de onAuthStateChanged
       console.error(`%cAuthContext (handleLoginSuccess): FAILED to ${operationAttempted} for UID: ${firebaseUser.uid}. Error: ${error.message}. REVISA PERMISOS.`, "color: red; font-weight: bold;");
    }
    
    try {
      await fetchUserAppDataCallback(firebaseUser.uid); // Cargar perfil y datos de racha
    } catch (error) {
       console.error(`%cAuthContext: Error en handleLoginSuccessCallback al llamar a fetchUserAppData:`, "color: red;", error);
    } finally {
      setLoading(false); 
      console.log(`%cAuthContext: handleLoginSuccessCallback complete for ${firebaseUser.uid}. Loading is now false.`, "color: green;");
    }
  }, [fetchUserAppDataCallback]); 

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
