
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { auth, db, firebaseConfig } from '@/lib/firebaseConfig'; // Import firebaseConfig
import { onAuthStateChanged } from 'firebase/auth';
// getUserProfile ya no se llama desde aquí, getStudyStreakData sí.
import { getStudyStreakData } from "@/lib/actions"; 
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import type { UserProfile, StreakData } from "@/types";

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  streakData: StreakData | null;
  loading: boolean;
  fetchUserAppData: (uid: string) => Promise<void>; // Para cargar datos de perfil y racha
  refreshUserAppData: () => Promise<void>; // Para refrescar explícitamente (ej: después de práctica)
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
    console.log(`%cAuthContext: fetchUserAppDataCallback llamada para UID: ${uid}`, "color: blue;");
    if (!uid) {
      console.warn("%cAuthContext: fetchUserAppDataCallback llamada sin UID. Limpiando datos de usuario.", "color: yellow;");
      setUserProfile(null);
      setStreakData(null);
      return;
    }
    
    let profile: UserProfile | null = null;
    let streaks: StreakData | null = null;
    let profileReadError = false;

    // 1. Cargar Perfil de Usuario directamente
    try {
      console.log(`%cAuthContext: Intentando LEER perfil desde Firestore. Path: /users/${uid}`, "color: blue;");
      const userDocRef = doc(db, "users", uid);
      const profileSnap = await getDoc(userDocRef);

      if (profileSnap.exists()) {
        const data = profileSnap.data();
        profile = { 
          ...data, 
          uid,
          // Convertir Timestamps a Dates si es necesario
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined),
          lastLoginAt: data.lastLoginAt instanceof Timestamp ? data.lastLoginAt.toDate() : (data.lastLoginAt ? new Date(data.lastLoginAt) : undefined),
          age: data.age === undefined || data.age === null ? '' : Number(data.age),
          gender: data.gender === undefined || data.gender === null ? '' : String(data.gender),
        } as UserProfile;
        setUserProfile(profile);
        console.log(`%cAuthContext: Perfil encontrado para ${uid}:`, "color: blue;", profile);
      } else {
        setUserProfile(null);
        profileReadError = true; // Considerar perfil no encontrado como un tipo de "error" para la lógica de creación.
        console.warn(`%cAuthContext: Documento de perfil NO encontrado en Firestore para UID: ${uid} en '/users/${uid}'`, "color: orange;");
      }
    } catch (error: any) {
      profileReadError = true;
      const errorMessage = error.message || "Error desconocido al obtener perfil.";
      // Mensaje de diagnóstico CRÍTICO para errores de permisos
      if (errorMessage.includes("permission-denied") || errorMessage.includes("permisos")) {
          const projectIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
          const projectIdFromConfigHardcoded = firebaseConfig.projectId; // Asegúrate que firebaseConfig está importado
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
            `Error original de Firestore reportado desde AuthContext: "${errorMessage}"\n\n`,
            "background: #FFD2D2; color: #D8000C; font-size: 12px; font-weight: bold; padding: 10px; border: 1px solid #D8000C; line-height: 1.5;"
          );
        } else {
            console.warn(`%cAuthContext: Error al obtener el perfil para UID ${uid} (no es un error de permisos): ${errorMessage}`, "color: red; font-weight: bold;");
        }
      setUserProfile(null);
    }

    // 2. Cargar Datos de Racha
    try {
      streaks = await getStudyStreakData(uid); // Esta es la acción de servidor
      // Asegurar que se establece un nuevo objeto para forzar re-render
      setStreakData(currentStreaks => {
        if (streaks && JSON.stringify(streaks) !== JSON.stringify(currentStreaks)) {
          console.log(`%cAuthContext: Streak data SET/UPDATED for ${uid}:`, "color: blue;", JSON.stringify({
            ...streaks,
            completedDates: streaks.completedDates.map(d => d.toISOString())
          }));
          return streaks;
        }
        return currentStreaks; // No hay cambio, o streaks es null
      });
      if (!streaks) { // Si getStudyStreakData devuelve null o un objeto por defecto que interpretamos como "no datos"
        console.log(`%cAuthContext: No streak data found or error for ${uid}. Setting streakData to default/null.`, "color: orange;");
        // setStreakData(null); // O un estado inicial vacío si es preferible
      }
    } catch (error) {
      console.error(`%cAuthContext: Error al obtener datos de racha para UID ${uid}:`, "color: red;", error);
      setStreakData(null); // O un estado inicial vacío
    }
  }, [db]); // db es estable, firebaseConfig también.

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
    setUser(firebaseUser); // Establecer usuario inmediatamente
    
    try {
      await fetchUserAppDataCallback(firebaseUser.uid); 
    } catch (error) {
       console.error(`%cAuthContext: Error en handleLoginSuccessCallback al llamar a fetchUserAppData:`, "color: red;", error);
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
        setLoading(true); // Iniciar carga para datos del usuario
        
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
              lastLoginAt: serverTimestamp(),
            });
            console.log(`%cAuthContext: Perfil CREADO automáticamente en Firestore para UID: ${firebaseUser.uid} en '/users'`, "color: green; font-weight: bold;");
          } else {
             console.log(`%cAuthContext: Perfil ya existe para UID: ${firebaseUser.uid} en '/users'. Actualizando lastLoginAt...`, "color: green;");
             // Actualizar lastLoginAt si el perfil ya existe
             await updateDoc(userDocRef, { lastLoginAt: serverTimestamp() });
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
