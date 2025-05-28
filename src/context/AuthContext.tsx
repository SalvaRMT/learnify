
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { auth, db, firebaseConfig } from '@/lib/firebaseConfig'; // Import firebaseConfig
import { onAuthStateChanged } from 'firebase/auth';
// getUserProfile ya no se llama desde aquí, getStudyStreakData sí.
import { getStudyStreakData } from "@/lib/actions"; 
import { doc, getDoc, setDoc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore"; // Added updateDoc
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

  // Callback para cargar perfil y datos de racha
  const fetchUserAppDataCallback = useCallback(async (uid: string) => {
    console.log(`%cAuthContext: fetchUserAppDataCallback called for UID: ${uid}`, "color: blue;");
    if (!uid) {
      console.warn("%cAuthContext: fetchUserAppDataCallback called without UID. Limpiando datos de usuario.", "color: yellow;");
      setUserProfile(null);
      setStreakData(null);
      return;
    }
    
    let profile: UserProfile | null = null;
    let streaks: StreakData | null = null;
    let profileReadError = false;
    let firestoreError = null;

    // 1. Cargar Perfil de Usuario directamente desde el cliente
    try {
      console.log(`%cAuthContext: Attempting to GET profile from Firestore. Path: /users/${uid}`, "color: blue;");
      const userDocRef = doc(db, "users", uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        profile = { 
          ...data, 
          uid,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined),
          lastLoginAt: data.lastLoginAt instanceof Timestamp ? data.lastLoginAt.toDate() : (data.lastLoginAt ? new Date(data.lastLoginAt) : undefined),
          age: data.age === undefined || data.age === null ? '' : Number(data.age),
          gender: data.gender === undefined || data.gender === null ? '' : String(data.gender),
        } as UserProfile;
        setUserProfile(profile);
        console.log(`%cAuthContext: Profile FOUND for ${uid}:`, "color: green;", profile);
      } else {
        profileReadError = true; // Considerar perfil no encontrado como un tipo de "error" para la lógica de creación.
        firestoreError = "Perfil no encontrado en Firestore.";
        console.warn(`%cAuthContext: Documento de perfil NO encontrado en Firestore para UID: ${uid} en '/users/${uid}'`, "color: orange;");
        setUserProfile(null); // Asegurar que el perfil se establece a null si no se encuentra
      }
    } catch (error: any) {
      profileReadError = true;
      firestoreError = error.message || "Error desconocido al obtener perfil.";
      const errorMessage = error.message || "Error desconocido al obtener perfil.";
      
      const projectIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; 
      const projectIdFromConfigHardcoded = firebaseConfig.projectId; 
      // ESTE MENSAJE DE CONSOLA ES UN DIAGNÓSTICO. INDICA QUE LAS REGLAS DE SEGURIDAD DE FIRESTORE SON INCORRECTAS.
      // LA SOLUCIÓN ES ARREGLAR LAS REGLAS EN LA CONSOLA DE FIREBASE, NO EN ESTE CÓDIGO.
      // SI EL ERROR ORIGINAL ES 'updateDoc is not defined', SIGNIFICA QUE FALTA IMPORTAR 'updateDoc' DE 'firebase/firestore' EN ESTE ARCHIVO.
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
        `Error original de Firestore reportado dentro de AuthContext: "${errorMessage}"\n\n`,
        "background: #FFD2D2; color: #D8000C; font-size: 12px; font-weight: bold; padding: 10px; border: 1px solid #D8000C; line-height: 1.5;"
      );
      setUserProfile(null); // Asegurar que el perfil se establece a null en caso de error
    }

    // 2. Cargar Datos de Racha
    try {
      streaks = await getStudyStreakData(uid); 
      setStreakData(currentStreaks => {
        if (streaks && JSON.stringify(streaks) !== JSON.stringify(currentStreaks)) {
          console.log(`%cAuthContext: Streak data SET/UPDATED for ${uid}.`, "color: blue;");
          return streaks;
        }
        return currentStreaks;
      });
      if (!streaks) { 
        console.log(`%cAuthContext: No streak data found or error for ${uid}. Setting streakData to default/null.`, "color: orange;");
      }
    } catch (error) {
      console.error(`%cAuthContext: Error al obtener datos de racha para UID ${uid}:`, "color: red;", error);
      setStreakData(null);
    }
  }, []); // firebaseConfig es estable

  // Para refrescar datos explícitamente
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

  // Manejar inicio de sesión exitoso (llamado desde LoginForm)
  const handleLoginSuccessCallback = useCallback(async (firebaseUser: FirebaseUser) => {
    console.log(`%cAuthContext: handleLoginSuccessCallback para ${firebaseUser.uid}. Estableciendo loading true.`, "color: green; font-weight: bold;");
    setLoading(true); 
    setUser(firebaseUser); 
    
    try {
      // Intentar crear perfil si no existe ANTES de llamar a fetchUserAppData
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        console.log(`%cAuthContext (handleLoginSuccess): Perfil NO encontrado para ${firebaseUser.uid}. Creando...`, "color: orange;");
        await setDoc(userDocRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          fullName: firebaseUser.displayName || firebaseUser.email || "",
          createdAt: serverTimestamp(),
          practiceTime: 15,
          age: null,
          gender: null,
          authProvider: firebaseUser.providerData?.[0]?.providerId || "password",
          lastLoginAt: serverTimestamp(),
        });
        console.log(`%cAuthContext (handleLoginSuccess): Perfil CREADO para ${firebaseUser.uid}.`, "color: green;");
      } else {
         console.log(`%cAuthContext (handleLoginSuccess): Perfil ya existe para ${firebaseUser.uid}. Actualizando lastLoginAt...`, "color: green;");
         await updateDoc(userDocRef, { lastLoginAt: serverTimestamp() });
      }
      await fetchUserAppDataCallback(firebaseUser.uid); 
    } catch (error: any) {
       console.error(`%cAuthContext: Error en handleLoginSuccessCallback (creando perfil o fetchUserAppData):`, "color: red;", error.message);
       // Aún así, proceder a poner loading false. El fetchUserAppData manejará su propio setUserProfile(null) si es necesario.
    } finally {
      setLoading(false); 
      console.log(`%cAuthContext: handleLoginSuccessCallback completo para ${firebaseUser.uid}. Loading es ahora false.`, "color: green;");
    }
  }, [fetchUserAppDataCallback]);

  // Suscribirse a cambios de estado de autenticación
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
            operationAttempted = "setDoc (crear perfil)"; 
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
              lastLoginAt: serverTimestamp(),
            });
            console.log(`%cAuthContext: Perfil CREADO automáticamente en Firestore para UID: ${firebaseUser.uid} en '/users'`, "color: green; font-weight: bold;");
          } else {
             // Perfil ya existe, actualizar lastLoginAt
             operationAttempted = "updateDoc (actualizar lastLoginAt)";
             console.log(`%cAuthContext: Perfil ya existe para UID: ${firebaseUser.uid} en '/users'. Actualizando lastLoginAt...`, "color: green;");
             await updateDoc(userDocRef, { lastLoginAt: serverTimestamp() });
          }
        } catch (error: any) {
            const createProfileErrorMessage = error.message || "Error desconocido durante la verificación/creación del perfil.";
            const projectIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
            const projectIdFromConfigHardcoded = firebaseConfig.projectId; 
            // ESTE MENSAJE DE CONSOLA ES UN DIAGNÓSTICO. INDICA QUE LAS REGLAS DE SEGURIDAD DE FIRESTORE SON INCORRECTAS.
            // LA SOLUCIÓN ES ARREGLAR LAS REGLAS EN LA CONSOLA DE FIREBASE, NO EN ESTE CÓDIGO.
            // SI EL ERROR ORIGINAL ES 'updateDoc is not defined', SIGNIFICA QUE FALTA IMPORTAR 'updateDoc' DE 'firebase/firestore' EN ESTE ARCHIVO.
            const finalProjectId = projectIdFromEnv || projectIdFromConfigHardcoded || "DESCONOCIDO";
            
            console.error(
              `%c\n\n🆘🆘🆘 ALERTA CRÍTICA DE PERMISOS DE FIRESTORE (Proyecto: ${finalProjectId}) 🆘🆘🆘\n\n` +
              `AuthContext: FALLÓ al ${operationAttempted} para UID: ${firebaseUser.uid} en onAuthStateChanged.\n` +
              `ERROR: ${createProfileErrorMessage}\n\n` +
              `CAUSA MÁS PROBABLE: Tus REGLAS DE SEGURIDAD de Firestore NO PERMITEN:\n` +
              `  1. LEER ('get') el documento '/users/${firebaseUser.uid}' (para verificar si existe).\n` + 
              `  O\n` +
              `  2. CREAR ('create') el documento '/users/${firebaseUser.uid}' (si no existía).\n` +
              `  O\n` +
              `  3. ACTUALIZAR ('update') el documento '/users/${firebaseUser.uid}' (para 'lastLoginAt').\n\n` +
              `ACCIÓN REQUERIDA (EN LA CONSOLA DE FIREBASE -> Firestore Database -> Rules):\n` +
              `Asegúrate de tener reglas como:\n` +
              `  match /users/{userId} {\n` + 
              `    allow read: if request.auth.uid == userId;\n` +
              `    allow create: if request.auth.uid == userId; // Y que el ID del doc sea el UID del usuario\n` +
              `    allow update: if request.auth.uid == userId; // Para actualizar 'lastLoginAt'\n` +
              `    // ... (otras reglas: delete)\n` +
              `  }\n` +
              `URL: https://console.firebase.google.com/project/${finalProjectId}/firestore/rules\n\n` +
              `**LA APLICACIÓN NO FUNCIONARÁ CORRECTAMENTE HASTA QUE ESTOS PERMISOS SE CORRIJAN EN FIREBASE.**\n\n`,
              "background: #FFD2D2; color: #D8000C; font-size: 12px; font-weight: bold; padding: 10px; border: 1px solid #D8000C; line-height: 1.5;"
            );
        }
        
        await fetchUserAppDataCallback(firebaseUser.uid); // Carga perfil y rachas
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
  }, [fetchUserAppDataCallback]); // fetchUserAppDataCallback está memoizado

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

    