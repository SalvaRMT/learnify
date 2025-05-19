
"use server";

import { auth, db } from "@/lib/firebaseConfig";
import { 
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, getDocs, writeBatch, Timestamp, limit } from "firebase/firestore";
import { z } from "zod";
import type { UserProfile, StreakData } from "@/types"; 

// =========================================================================================
// MUY IMPORTANTE: ¡ERRORES DE PERMISOS DE LECTURA/ESCRITURA DE FIRESTORE!
//
// Si ves errores en la consola que dicen "permission-denied", "permisos insuficientes",
// "Missing or insufficient permissions", o mensajes de la aplicación que indican
// problemas de permisos de Firestore, significa que TUS REGLAS DE SEGURIDAD DE
// FIRESTORE están incorrectas.
//
// DEBES ir a tu Consola de Firebase -> Firestore Database -> Rules (Reglas)
// y asegurarte de que tus reglas permitan las operaciones necesarias.
//
// Ejemplo de REGLAS BÁSICAS (ajusta según tus necesidades):
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//
//     match /users/{userId} {
//       // Un usuario autenticado puede LEER, ACTUALIZAR y BORRAR SU PROPIO documento.
//       // También puede CREAR SU PROPIO documento (al registrarse).
//       allow read, update, delete: if request.auth != null && request.auth.uid == userId;
//       allow create: if request.auth != null && request.auth.uid == userId;
//
//       // Subcolecciones para rachas y progreso diario
//       match /streaks/summary {
//         allow read, write: if request.auth != null && request.auth.uid == userId;
//       }
//       match /dailyProgress/{dateId} {
//          allow read, write: if request.auth != null && request.auth.uid == userId;
//       }
//     }
//
//     match /questions/{questionId} {
//       // Permitir a usuarios autenticados leer preguntas.
//       allow read: if request.auth != null;
//     }
//   }
// }
//
// El código de la aplicación NO PUEDE solucionar estos problemas de permisos por sí mismo.
// La corrección DEBE hacerse en tus REGLAS DE SEGURIDAD DE FIRESTORE.
// =========================================================================================


// Tipos para las preguntas, similar al que podrías tener en el frontend
export interface Question {
  id: string;
  topic: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

const UNAVAILABLE_ERROR_MESSAGE = "Operación fallida. Por favor, verifica tu conexión a internet. Además, asegúrate de que Firestore esté habilitado e inicializado en la consola de tu proyecto de Firebase.";

export async function savePracticeTime(userId: string, values: { practiceTime: number }) {
  const PracticeTimeSchema = z.object({
    practiceTime: z.coerce.number().min(5, "El tiempo de práctica debe ser de al menos 5 minutos por día."),
  });

  const validatedFields = PracticeTimeSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Tiempo de práctica inválido." };
  }

  const { practiceTime } = validatedFields.data;

  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, { practiceTime });
    return { success: "¡Tiempo de práctica guardado!" };
  } catch (error: any) {
    console.error("Error al guardar el tiempo de práctica (actions.ts):", error);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied') {
      return { error: `Error al guardar el tiempo de práctica: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore permitan la operación 'update' en el documento '/users/${userId}' para el usuario autenticado. La regla común es 'allow update: if request.auth.uid == userId;' dentro de 'match /users/{userId} { ... }'. (Código: ${error.code})` };
    }
    return { error: `Error al guardar el tiempo de práctica: ${error.message}` };
  }
}

export async function updateUserProfile(userId: string, values: Partial<UserProfile>) {
  // El esquema Zod ya está definido en ProfileForm.tsx y es complejo con transformaciones.
  // Aquí, asumimos que `values` ya ha sido validado y transformado por el formulario.
  // Sin embargo, para seguridad, podríamos revalidar o usar un esquema más simple aquí.
  const dataToUpdate: { [key: string]: any } = {};

  if (values.fullName !== undefined) dataToUpdate.fullName = values.fullName === "" ? null : values.fullName;
  
  // Para 'age', si es string vacío desde el form, se convierte a null. Si es número, se usa.
  if (values.age !== undefined) {
    dataToUpdate.age = values.age === '' || values.age === null ? null : Number(values.age);
  }
  
  // Para 'gender', si es string vacío desde el form, se convierte a null.
  if (values.gender !== undefined) {
    dataToUpdate.gender = values.gender === "" || values.gender === null ? null : values.gender;
  }
  
  if (values.practiceTime !== undefined) dataToUpdate.practiceTime = Number(values.practiceTime);


  if (Object.keys(dataToUpdate).length === 0) {
    return { success: "No hay cambios para actualizar." };
  }
  dataToUpdate.lastUpdatedAt = serverTimestamp(); // Añadir marca de tiempo de actualización


  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, dataToUpdate);
    return { success: "¡Perfil actualizado correctamente!" };
  } catch (error: any) {
    console.error("Error al actualizar el perfil (actions.ts):", error);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied') {
      return { 
        error: `Error al actualizar el perfil: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan la operación 'update' en el documento '/users/${userId}' para el usuario autenticado. La regla común es 'allow update: if request.auth.uid == userId;' dentro de 'match /users/{userId} { ... }'. (Código: ${error.code})`
      };
    }
    return { error: `Error al actualizar el perfil: ${error.message}` };
  }
}

export async function signOutUser(): Promise<{ success?: string; error?: string }> {
  try {
    await firebaseSignOut(auth); 
    return { success: "Sesión cerrada correctamente." };
  } catch (error: any) {
    console.error("Error al cerrar sesión (actions.ts):", error);
    return { error: `Error al cerrar sesión: ${error.message}` };
  }
}

export async function getUserProfile(userId: string): Promise<{ success: boolean, data?: UserProfile, error?: string }> {
  // =========================================================================================
  // ¡¡¡ ATENCIÓN DESARROLLADOR: ESTE MENSAJE ES IMPORTANTE !!!
  //
  // SI VES UN ERROR EN LA CONSOLA DEL NAVEGADOR (PROVENIENTE DE AuthContext.tsx) QUE DICE:
  // "[ALERTA CRÍTICA DE PERMISOS DE FIRESTORE... La aplicación NO PUEDE LEER el perfil...
  //  ...Revisa tus REGLAS DE SEGURIDAD de Firestore... la regla necesaria es
  //  'allow read: if request.auth.uid == userId;' en la ruta '/users/{userId}']"
  //
  // SIGNIFICA QUE TUS REGLAS DE SEGURIDAD DE FIRESTORE SON INCORRECTAS.
  //
  // DEBES IR A TU CONSOLA DE FIREBASE -> Firestore Database -> Rules (Reglas)
  // Y ASEGURARTE DE QUE LA REGLA PARA LA COLECCIÓN 'users' SEA:
  //
  //   match /users/{userId} {
  //     allow read: if request.auth.uid == userId;
  //     // ... y también 'allow create, update, delete' según necesites ...
  //   }
  //
  // ESTE CÓDIGO DE LA APLICACIÓN NO PUEDE SOLUCIONAR UN PROBLEMA DE PERMISOS.
  // LA CORRECCIÓN DEBE HACERSE EN TUS REGLAS DE SEGURIDAD EN FIREBASE.
  // =========================================================================================
  console.log(`[getUserProfile Server Action] Intentando obtener perfil para userId: ${userId}`);
  try {
    const userDocRef = doc(db, "users", userId);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const profileData: UserProfile = { 
        ...data, 
        uid: userId,
        // Convertir Timestamps a Date si existen
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
        lastLoginAt: data.lastLoginAt instanceof Timestamp ? data.lastLoginAt.toDate() : undefined,
        lastUpdatedAt: data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt.toDate() : undefined,
        age: data.age === undefined || data.age === null ? '' : Number(data.age), // Asegurar que age sea número o string vacío
        gender: data.gender === undefined || data.gender === null ? '' : String(data.gender),
      };
      return { success: true, data: profileData };
    } else {
      console.warn(`[getUserProfile Server Action] Perfil de usuario no encontrado en Firestore para UID: ${userId}`);
      return { success: false, error: "Perfil de usuario no encontrado." };
    }
  } catch (error: any) {
    console.error("[getUserProfile Server Action] Error al obtener el perfil:", error);
     if (error.code === 'unavailable') {
      return { success: false, error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied') {
      return { success: false, error: "Error al obtener el perfil debido a permisos de Firestore." };
    }
    return { success: false, error: `Error al obtener el perfil: ${error.message}` };
  }
}

export async function getStudyStreakData(userId: string): Promise<StreakData> {
  const userDocRef = doc(db, "users", userId, "streaks", "summary");
  console.log(`[getStudyStreakData] Obteniendo para userId: ${userId}`);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const completedDates = (data.completedDates || []).map((ts: any) => {
        if (ts instanceof Timestamp) {
          return ts.toDate();
        }
        // Manejar otros formatos si es necesario, pero preferiblemente guardar como Timestamp
        const dateObj = new Date(ts);
        return isNaN(dateObj.getTime()) ? new Date(0) : dateObj; // Devolver fecha inválida si no se puede parsear
      }).filter((d: Date) => d.getTime() !== new Date(0).getTime()); // Filtrar fechas inválidas

      const streakSummary = {
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        totalQuestionsAnswered: data.totalQuestionsAnswered || 0,
        completedDates: completedDates,
      };
      console.log(`[getStudyStreakData] Datos encontrados para ${userId}:`, streakSummary);
      return streakSummary;
    } else {
      console.log(`[getStudyStreakData] No hay datos para ${userId}, devolviendo valores por defecto.`);
      return { currentStreak: 0, longestStreak: 0, totalQuestionsAnswered: 0, completedDates: [] };
    }
  } catch(error: any) {
    console.error("[getStudyStreakData] Error obteniendo datos de racha:", error);
    if (error.code === 'unavailable' || error.code === 'permission-denied') {
      console.error(`[getStudyStreakData] Error de Firestore (Código: ${error.code}): ${UNAVAILABLE_ERROR_MESSAGE}`);
    }
    // Devolver valores por defecto en caso de error para no romper la UI
    return { currentStreak: 0, longestStreak: 0, totalQuestionsAnswered: 0, completedDates: [] };
  }
}

const exampleQuestionsData: Question[] = [
  { id: "geo1", topic: "Geografía Mundial", question: "¿Cuál es el río más largo del mundo?", options: ["Amazonas", "Nilo", "Yangtsé", "Misisipi"], correctAnswer: "Amazonas" },
  { id: "sci1", topic: "Ciencia Elemental", question: "¿Cuál es el símbolo químico del oro?", options: ["Ag", "Au", "Pb", "Fe"], correctAnswer: "Au" },
  { id: "mat1", topic: "Matemáticas Básicas", question: "¿Cuánto es 2 + 2?", options: ["3", "4", "5", "22"], correctAnswer: "4" },
  { id: "his1", topic: "Historia Universal", question: "¿En qué año comenzó la Segunda Guerra Mundial?", options: ["1939", "1941", "1914", "1945"], correctAnswer: "1939" },
  { id: "lit1", topic: "Literatura Clásica", question: "¿Quién escribió 'Don Quijote de la Mancha'?", options: ["Miguel de Cervantes", "William Shakespeare", "Homero", "Dante Alighieri"], correctAnswer: "Miguel de Cervantes" },
];

export async function getPracticeQuestions(): Promise<Question[]> {
  console.log("[getPracticeQuestions] Intentando obtener preguntas de Firestore...");
  try {
    const questionsColRef = collection(db, 'questions');
    // Obtener todas las preguntas, luego seleccionar aleatoriamente en el cliente/servidor
    const querySnapshot = await getDocs(query(questionsColRef, limit(50))); // Limitar a 50 para no traer demasiadas
    
    const allQuestions: Question[] = [];
    querySnapshot.forEach((docSnap) => {
      allQuestions.push({ id: docSnap.id, ...docSnap.data() } as Question);
    });

    if (allQuestions.length === 0) {
      console.warn("[getPracticeQuestions] No se encontraron preguntas en Firestore. Devolviendo preguntas de ejemplo.");
      return exampleQuestionsData; // O devolver array vacío: return [];
    }

    // Seleccionar aleatoriamente 5 preguntas
    const shuffledQuestions = allQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffledQuestions.slice(0, Math.min(5, shuffledQuestions.length));
    
    console.log(`[getPracticeQuestions] Seleccionadas ${selectedQuestions.length} preguntas de ${allQuestions.length} disponibles en Firestore.`);
    return selectedQuestions;

  } catch (error: any) {
    console.error("[getPracticeQuestions] Error al obtener preguntas de práctica de Firestore:", error);
    if (error.code === 'unavailable') {
      console.error(`[getPracticeQuestions] Error de Firestore (Código: ${error.code}): ${UNAVAILABLE_ERROR_MESSAGE}`);
    } else if (error.code === 'permission-denied') {
      // Este es un log importante si las reglas de 'questions' no permiten leer.
      console.error("[getPracticeQuestions] PERMISO DENEGADO al leer la colección 'questions'. Revisa tus reglas de seguridad de Firestore. La regla necesaria es 'allow read: if request.auth != null;' en la ruta 'match /questions/{questionId}'.");
    }
    console.warn("[getPracticeQuestions] Devolviendo preguntas de ejemplo debido a un error.");
    return exampleQuestionsData; // O devolver array vacío: return [];
  }
}

export async function recordPracticeSession(userId: string, questionsAnsweredCorrectly: number, topicsCovered: string[]) {
  console.log(`[recordPracticeSession] Iniciando para userId: ${userId}, preguntasRespondidasCorrectamente: ${questionsAnsweredCorrectly}, temasCubiertos:`, topicsCovered);

  if (!userId) {
    console.error("[recordPracticeSession] Error: Falta userId.");
    return { error: "ID de usuario faltante." };
  }

  if (questionsAnsweredCorrectly <= 0) {
    console.log("[recordPracticeSession] No se respondieron preguntas correctamente, no se actualiza la racha ni el progreso diario. Solo se actualizará el total de preguntas si el resumen existe.");
    const streakSummaryRef = doc(db, "users", userId, "streaks", "summary");
    try {
        const summarySnap = await getDoc(streakSummaryRef);
        if (summarySnap.exists()) {
            const currentTotal = summarySnap.data().totalQuestionsAnswered || 0;
            // await updateDoc(streakSummaryRef, { totalQuestionsAnswered: currentTotal }); // No es necesario si no hay correctas
        }
    } catch (e:any) {
        console.warn(`[recordPracticeSession] No se pudo acceder al resumen de racha para actualizar totalQuestions (puede que aún no exista o por permisos): ${e.message}`);
    }
    return { success: "No hay preguntas correctas para actualizar la racha." };
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    console.log(`[recordPracticeSession] Hoy (normalizado): ${today.toISOString()}`);

    const streakSummaryRef = doc(db, "users", userId, "streaks", "summary");
    const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dailyRecordRef = doc(db, "users", userId, "dailyProgress", todayDateStr);

    const batch = writeBatch(db);

    const summarySnap = await getDoc(streakSummaryRef);
    let { 
      currentStreak = 0, 
      longestStreak = 0, 
      totalQuestionsAnswered: summaryTotalQuestions = 0, 
      lastPracticeDate, // Este será un Firestore Timestamp
      completedDates = [] // Este será un array de Firestore Timestamps
    } = summarySnap.exists() ? summarySnap.data() : {};
    
    console.log("[recordPracticeSession] Resumen de racha inicial de Firestore:", { currentStreak, longestStreak, summaryTotalQuestions, lastPracticeDate: lastPracticeDate?.toDate?.().toISOString(), completedDates: completedDates.map((d: any) => d instanceof Timestamp ? d.toDate().toISOString() : (d ? new Date(d).toISOString() : null) ) });

    // Convertir completedDates de Timestamps a objetos Date de JS para la lógica
    let completedDatesJS: Date[] = (completedDates || []).map((d: Timestamp | Date | string) => {
        let dateObj: Date;
        if (d instanceof Timestamp) dateObj = d.toDate();
        else if (d instanceof Date) dateObj = new Date(d.getTime()); // Crear nueva instancia para evitar mutaciones
        else dateObj = new Date(d); // Intentar parsear si es string

        if (isNaN(dateObj.getTime())) return new Date(0); // Fecha inválida
        dateObj.setHours(0, 0, 0, 0); // Normalizar
        return dateObj;
    }).filter((d: Date) => d.getTime() !== new Date(0).getTime()); // Filtrar fechas inválidas

    console.log("[recordPracticeSession] completedDatesJS procesadas (normalizadas):", completedDatesJS.map(d => d.toISOString()));

    const practiceDayAlreadyRecorded = completedDatesJS.some(d => d.getTime() === today.getTime());
    console.log(`[recordPracticeSession] ¿Día de práctica ya registrado para hoy?: ${practiceDayAlreadyRecorded}`);

    if (!practiceDayAlreadyRecorded) {
        console.log("[recordPracticeSession] Hoy no se ha registrado práctica. Calculando nueva racha...");
        const lastPracticeDateJS = lastPracticeDate instanceof Timestamp ? lastPracticeDate.toDate() : (lastPracticeDate ? new Date(lastPracticeDate) : null);
        if (lastPracticeDateJS) {
            lastPracticeDateJS.setHours(0,0,0,0); // Normalizar última fecha de práctica
            console.log(`[recordPracticeSession] Última fecha de práctica (normalizada): ${lastPracticeDateJS.toISOString()}`);
            
            const yesterday = new Date(today); // `today` ya está normalizada
            yesterday.setDate(today.getDate() - 1);
            // No es necesario normalizar `yesterday` de nuevo, ya se basa en `today` normalizada.
            console.log(`[recordPracticeSession] Ayer (calculado desde 'today' normalizado): ${yesterday.toISOString()}`);

            if (lastPracticeDateJS.getTime() === yesterday.getTime()) {
                currentStreak += 1; 
                console.log("[recordPracticeSession] Racha continuada. Nueva racha actual:", currentStreak);
            } else { 
                currentStreak = 1; // Se rompió la racha o es la primera después de un espacio
                console.log("[recordPracticeSession] Racha rota o primera práctica después de un espacio. Nueva racha actual:", currentStreak);
            }
        } else { // No hay última fecha de práctica registrada
            currentStreak = 1; 
            console.log("[recordPracticeSession] Primera práctica registrada. Nueva racha actual:", currentStreak);
        }
        
        if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
            console.log("[recordPracticeSession] Nueva racha más larga:", longestStreak);
        }
        
        // Añadir 'today' (que ya está normalizada) al array de fechas completadas en JS
        completedDatesJS.push(new Date(today.getTime())); // Asegurar nueva instancia si 'today' se muta
        console.log("[recordPracticeSession] Hoy añadido a completedDatesJS. Nuevo array:", completedDatesJS.map(d => d.toISOString()));
    } else {
      console.log("[recordPracticeSession] Ya se practicó hoy. Racha no modificada. Solo se actualizará el total de preguntas y el progreso diario.");
    }
    
    // Actualizar el total de preguntas respondidas
    summaryTotalQuestions += questionsAnsweredCorrectly; 
    console.log("[recordPracticeSession] Total de preguntas respondidas actualizado:", summaryTotalQuestions);

    // Datos para escribir en el resumen de racha
    const dataForSummary = {
      currentStreak,
      longestStreak,
      totalQuestionsAnswered: summaryTotalQuestions,
      lastPracticeDate: Timestamp.fromDate(today), // Usar `today` normalizada
      completedDates: completedDatesJS.map(d => Timestamp.fromDate(d)) // Convertir de nuevo a Timestamps
    };
    console.log("[recordPracticeSession] Datos para escribir en el resumen de racha:", dataForSummary);
    batch.set(streakSummaryRef, dataForSummary, { merge: true }); // Usar merge:true para crear si no existe o actualizar

    // Datos para el progreso diario
    const dailyProgressSnap = await getDoc(dailyRecordRef);
    const existingDailyQuestions = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.questionsAnswered : 0;
    const existingTopics = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.topics : [];
    
    // Unir temas sin duplicados
    const updatedTopics = Array.from(new Set([...existingTopics, ...topicsCovered]));
    
    const dataForDaily = {
      questionsAnswered: existingDailyQuestions + questionsAnsweredCorrectly,
      topics: updatedTopics, 
      date: Timestamp.fromDate(today), // Usar `today` normalizada
    };
    console.log("[recordPracticeSession] Datos para escribir en el progreso diario:", dataForDaily);
    batch.set(dailyRecordRef, dataForDaily, { merge: true }); // Usar merge:true para crear si no existe o actualizar

    await batch.commit();
    console.log("[recordPracticeSession] Batch commit exitoso.");

    return { success: "¡Sesión de práctica registrada!" };
  } catch (error: any) {
    console.error("[recordPracticeSession] Error durante la operación:", error);
     if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied') {
      return { 
          error: `Error al registrar la sesión: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan escribir en las subcolecciones '/users/${userId}/streaks/summary' Y '/users/${userId}/dailyProgress/{dateId}'. La regla común para subcolecciones es 'allow write: if request.auth.uid == userId;' dentro de 'match /users/{userId} { match /streaks/summary { ... } }'. (Código: ${error.code})` 
        };
    }
    return { error: `Error al registrar la sesión: ${error.message}` };
  }
}

    