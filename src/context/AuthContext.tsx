
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { auth, db, firebaseConfig } from '@/lib/firebaseConfig'; 
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

  console.log(`%cAuthProvider: Render/Re-render. Loading: ${loading}, User: ${user ? user.uid : 'null'}, Profile: ${userProfile ? 'cargado' : 'null'}, Streak: ${streakData ? 'cargado' : 'null'}`, "color: orange;");

  const fetchUserAppDataCallback = useCallback(async (uid: string) => {
    console.log(`%cAuthContext: fetchUserAppDataCallback llamada para UID: ${uid}`, "color: blue;");
    if (!uid) {
      console.warn("%cAuthContext: fetchUserAppDataCallback llamada sin UID. Limpiando datos de usuario.", "color: yellow;");
      setUserProfile(null);
      setStreakData(null);
      return;
    }
    
    let profileReadError = false;
    try {
      console.log(`%cAuthContext: Intentando LEER perfil desde Firestore. Path: /users/${uid}`, "color: blue;");
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
        console.log(`%cAuthContext: Perfil encontrado para ${uid}:`, "color: blue;", fetchedProfileData);
      } else {
        setUserProfile(null);
        console.warn(`%cAuthContext: Documento de perfil NO encontrado en Firestore para UID: ${uid} en '/users/${uid}'`, "color: orange;");
      }
    } catch (error: any) {
      profileReadError = true;
      const errorMessage = error.message || "Error desconocido al obtener perfil.";
      console.warn(`%cAuthContext: Profile NOT found or error for UID: ${uid}. Error: ${errorMessage}`, "color: red; font-weight: bold;");
      if (errorMessage.includes("permission-denied") || errorMessage.includes("permisos")) {
          // =========================================================================================
          // ESTE MENSAJE DE CONSOLA ES UN DIAGNÓSTICO. INDICA QUE LAS REGLAS DE SEGURIDAD DE FIRESTORE SON INCORRECTAS.
          // LA SOLUCIÓN ES ARREGLAR LAS REGLAS EN LA CONSOLA DE FIREBASE, NO EN ESTE CÓDIGO.
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
            `6. CONSEJO EXTRA: Utiliza el "Simulador de Reglas" en la pestaña 'Rules' de Firestore para probar tus reglas con el UID '${uid}'.\n\n`+
            `**ESTE MENSAJE ES UN DIAGNÓSTICO DE LA APLICACIÓN. LA SOLUCIÓN REQUIERE QUE ACTUALICES TUS REGLAS DE SEGURIDAD EN LA CONSOLA DE FIREBASE.**\n\n` +
            `Error original de Firestore reportado directamente desde AuthContext: "${errorMessage}"\n\n`,
            "background: #FFD2D2; color: #D8000C; font-size: 12px; font-weight: bold; padding: 10px; border: 3px solid darkred; line-height: 1.5;"
          );
        }
      setUserProfile(null);
    }

    try {
      const fetchedStreakData = await getStudyStreakData(uid);
      setStreakData(fetchedStreakData);
      console.log(`%cAuthContext: Streak data fetched for ${uid}:`, "color: blue;", JSON.stringify({
        ...fetchedStreakData,
        completedDates: fetchedStreakData.completedDates.map(d => d.toISOString())
      }));
    } catch (error) {
      console.error(`%cAuthContext: Error al obtener datos de racha para UID ${uid}:`, "color: red;", error);
      setStreakData(null);
    }
  }, []); 

  const handleLoginSuccessCallback = useCallback(async (firebaseUser: FirebaseUser) => {
    console.log(`%cAuthContext: handleLoginSuccessCallback para ${firebaseUser.uid}.`, "color: green; font-weight: bold;");
    setLoading(true); 
    setUser(firebaseUser);
    
    // La creación/verificación del perfil ya se maneja en el onAuthStateChanged global.
    // Aquí solo nos aseguramos de que se carguen los datos.
    try {
      await fetchUserAppDataCallback(firebaseUser.uid); 
    } catch (error) {
       console.error(`%cAuthContext: Error en handleLoginSuccessCallback al llamar a fetchUserAppData:`, "color: red;", error);
    } finally {
      setLoading(false); 
      console.log(`%cAuthContext: handleLoginSuccessCallback completo para ${firebaseUser.uid}. Loading es ahora false.`, "color: green;");
    }
  }, [fetchUserAppDataCallback]); 

  const refreshUserAppDataCallback = useCallback(async () => {
    if (user) {
      console.log(`%cAuthContext: refreshUserAppDataCallback llamada para UID: ${user.uid}. Estableciendo loading true.`, "color: purple;");
      setLoading(true);
      try {
        await fetchUserAppDataCallback(user.uid);
      } catch (error) {
        console.error(`%cAuthContext: Error durante refreshUserAppDataCallback para ${user.uid}:`, "color: red;", error);
      } finally {
        setLoading(false);
        console.log(`%cAuthContext: refreshUserAppDataCallback finalizada para UID: ${user.uid}. Loading establecido a false.`, "color: purple;");
      }
    } else {
      console.warn("%cAuthContext: refreshUserAppDataCallback llamada pero no hay usuario logueado.", "color: yellow;");
    }
  }, [user, fetchUserAppDataCallback]);

  useEffect(() => {
    console.log(`%cAuthContext useEffect[onAuthStateChanged]: Subscribing. Initial loading: ${loading}`, "color: magenta;");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(`%cAuthContext onAuthStateChanged: FIRED. FirebaseUser: ${firebaseUser ? firebaseUser.uid : 'null'}`, "color: teal; font-weight: bold;");
      if (firebaseUser) {
        setUser(firebaseUser); 
        setLoading(true); 
        
        let operationAttempted = "getDoc (verificar perfil)";
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid); 
          console.log(`%cAuthContext: Attempting to GET profile from Firestore. Path: /users/${firebaseUser.uid}, UID: ${firebaseUser.uid}`, "color: blue;");
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
            console.log(`%cAuthContext: Perfil CREADO automáticamente en Firestore para UID: ${firebaseUser.uid} en '/users'`, "color: green; font-weight: bold;");
          } else {
            console.log(`%cAuthContext: Perfil ya existe para UID: ${firebaseUser.uid} en '/users'`, "color: green;"); 
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
        
        await fetchUserAppDataCallback(firebaseUser.uid);
        setLoading(false); 
        console.log(`%cAuthContext onAuthStateChanged: User ${firebaseUser.uid} processed. Loading set to false.`, "color: teal;");
      } else {
        setUser(null);
        setUserProfile(null);
        setStreakData(null);
        setLoading(false); 
        console.log("%cAuthContext onAuthStateChanged: No FirebaseUser. Usuario, perfil, racha establecidos a null. Loading establecido a false.", "color: red;");
      }
    });

    return () => {
      console.log("%cAuthContext useEffect[onAuthStateChanged]: Desuscribiendo.", "color: magenta;");
      unsubscribe();
    };
  }, [fetchUserAppDataCallback]); 

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
