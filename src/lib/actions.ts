
"use server";

import { auth, db } from "@/lib/firebaseConfig";
import { 
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, getDocs, writeBatch, Timestamp, limit } from "firebase/firestore";
import { z } from "zod"; // Zod es necesario en tiempo de ejecución para los esquemas
import type { UserProfile, StreakData, Question } from "@/types"; 

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
export async function getUserProfile(userId: string): Promise<{ success: boolean, data?: UserProfile, error?: string }> {
  console.log(`[getUserProfile Server Action] Intentando obtener perfil para userId: ${userId}`);
  try {
    const userDocRef = doc(db, "users", userId);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const profileData: UserProfile = { 
        ...data, 
        uid: userId,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
        lastLoginAt: data.lastLoginAt instanceof Timestamp ? data.lastLoginAt.toDate() : undefined,
        lastUpdatedAt: data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt.toDate() : undefined,
        age: data.age === undefined || data.age === null ? '' : Number(data.age),
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
      return { success: false, error: `Operación fallida. Verifica tu conexión a internet y que Firestore esté habilitado e inicializado en Firebase. (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      return { success: false, error: "Error al obtener el perfil debido a permisos de Firestore." };
    }
    return { success: false, error: `Error al obtener el perfil: ${error.message}` };
  }
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
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      return { 
        error: `Error al guardar el tiempo de práctica: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore permitan la operación 'update' en el documento '/users/${userId}' para el usuario autenticado. La regla común es 'allow update: if request.auth.uid == userId;' dentro de 'match /users/${userId} { ... }'. (Código: ${error.code})` 
      };
    }
    return { error: `Error al guardar el tiempo de práctica: ${error.message}` };
  }
}

export async function updateUserProfile(userId: string, values: Partial<UserProfile>) {
  const dataToUpdate: { [key: string]: any } = {};

  if (values.fullName !== undefined) dataToUpdate.fullName = values.fullName === "" ? null : values.fullName;
  
  if (values.age !== undefined) {
    dataToUpdate.age = values.age === '' || values.age === null ? null : Number(values.age);
  }
  
  if (values.gender !== undefined) {
    dataToUpdate.gender = values.gender === "" || values.gender === null ? null : values.gender;
  }
  
  if (values.practiceTime !== undefined) dataToUpdate.practiceTime = Number(values.practiceTime);


  if (Object.keys(dataToUpdate).length === 0) {
    return { success: "No hay cambios para actualizar." };
  }
  dataToUpdate.lastUpdatedAt = serverTimestamp();


  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, dataToUpdate);
    return { success: "¡Perfil actualizado correctamente!" };
  } catch (error: any)
 {
    console.error("[updateUserProfile Server Action] Error al actualizar el perfil:", error);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      return { 
        error: `Error al actualizar el perfil: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan la operación 'update' en el documento '/users/${userId}' para el usuario autenticado. La regla común es 'allow update: if request.auth.uid == userId;' dentro de 'match /users/${userId}'. (Código: ${error.code})`
      };
    }
    return { error: `Error al actualizar el perfil: ${error.message}` };
  }
}

export async function signOutUser(): Promise<{ success?: string; error?: string }> {
  try {
    // This function is intended for server-side sign out if ever needed.
    // Client-side sign out is handled directly in components.
    // For a true server-side sign out affecting HttpOnly cookies or server sessions,
    // you'd use Firebase Admin SDK, which is not set up in this project.
    // This current implementation using client SDK on server might not be fully effective
    // for all server-side session management scenarios.
    console.log("[signOutUser Server Action] Attempting server-side sign out (limited effect for client SDK).");
    // await firebaseSignOut(auth); // This auth instance is server-side
    return { success: "Cierre de sesión del servidor intentado (efecto limitado)." };
  } catch (error: any) {
    console.error("Error en signOutUser (actions.ts):", error);
    return { error: `Error en el cierre de sesión del servidor: ${error.message}` };
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
    const querySnapshot = await getDocs(query(questionsColRef, limit(50))); 
    
    const allQuestions: Question[] = [];
    querySnapshot.forEach((docSnap) => {
      allQuestions.push({ id: docSnap.id, ...docSnap.data() } as Question);
    });

    if (allQuestions.length === 0) {
      console.warn("[getPracticeQuestions] No se encontraron preguntas en Firestore. Devolviendo preguntas de ejemplo.");
      return exampleQuestionsData;
    }

    const shuffledQuestions = allQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffledQuestions.slice(0, Math.min(5, shuffledQuestions.length));
    
    console.log(`[getPracticeQuestions] Seleccionadas ${selectedQuestions.length} preguntas de ${allQuestions.length} disponibles en Firestore.`);
    return selectedQuestions;

  } catch (error: any) {
    console.error("[getPracticeQuestions] Error al obtener preguntas de práctica de Firestore:", error);
    if (error.code === 'unavailable') {
      console.error(`[getPracticeQuestions] Error de Firestore (Código: ${error.code}): ${UNAVAILABLE_ERROR_MESSAGE}`);
    } else if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      console.error("[getPracticeQuestions] PERMISO DENEGADO al leer la colección 'questions'. Revisa tus reglas de seguridad de Firestore. La regla necesaria es 'allow read: if request.auth != null;' en la ruta 'match /questions/{questionId}'.");
    }
    console.warn("[getPracticeQuestions] Devolviendo preguntas de ejemplo debido a un error.");
    return exampleQuestionsData;
  }
}

export async function recordPracticeSession(userId: string, questionsAnsweredCorrectly: number, topicsCovered: string[]) {
  console.log(`[recordPracticeSession] Iniciando para userId: ${userId}, preguntasRespondidasCorrectamente: ${questionsAnsweredCorrectly}, temasCubiertos:`, topicsCovered);

  if (!userId) {
    console.error("[recordPracticeSession] Error: Falta userId.");
    return { error: "ID de usuario faltante." };
  }

  if (questionsAnsweredCorrectly <= 0) {
    console.log("[recordPracticeSession] No se respondieron preguntas correctamente, no se actualiza la racha ni el progreso diario.");
    return { success: "No hay preguntas correctas para actualizar la racha." };
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    console.log(`[recordPracticeSession] Fecha de hoy (normalizada): ${today.toISOString()}`);

    const streakSummaryRef = doc(db, "users", userId, "streaks", "summary");
    const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dailyRecordRef = doc(db, "users", userId, "dailyProgress", todayDateStr);

    const batch = writeBatch(db);

    const summarySnap = await getDoc(streakSummaryRef);
    let { 
      currentStreak = 0, 
      longestStreak = 0, 
      totalQuestionsAnswered: summaryTotalQuestions = 0, 
      lastPracticeDate, 
      completedDates = [] 
    } = summarySnap.exists() ? summarySnap.data() : {};
    
    console.log("[recordPracticeSession] Datos de racha iniciales de Firestore:", { 
      currentStreak, 
      longestStreak, 
      summaryTotalQuestions, 
      lastPracticeDate: lastPracticeDate instanceof Timestamp ? lastPracticeDate.toDate().toISOString() : lastPracticeDate,
      completedDates: (completedDates || []).map((d: any) => d instanceof Timestamp ? d.toDate().toISOString() : (d ? new Date(d).toISOString() : null)) 
    });

    // Convertir Timestamps a objetos Date de JS y normalizar a medianoche para lógica interna
    let completedDatesJS: Date[] = (completedDates || []).map((d: Timestamp | Date | string) => {
        let dateObj: Date;
        if (d instanceof Timestamp) dateObj = d.toDate();
        else if (d instanceof Date) dateObj = new Date(d.getTime()); // Clonar si ya es Date
        else dateObj = new Date(d); // Asumir string parseable

        if (isNaN(dateObj.getTime())) return new Date(0); // Fecha inválida, marcar para filtrar
        dateObj.setHours(0, 0, 0, 0); // Normalizar
        return dateObj;
    }).filter((d: Date) => d.getTime() !== new Date(0).getTime()); // Filtrar fechas inválidas

    console.log("[recordPracticeSession] completedDatesJS (normalizadas y filtradas):", completedDatesJS.map(d => d.toISOString()));

    const practiceDayAlreadyRecorded = completedDatesJS.some(d => d.getTime() === today.getTime());
    console.log(`[recordPracticeSession] ¿Día de práctica ya registrado para hoy (${today.toISOString()})?: ${practiceDayAlreadyRecorded}`);

    if (!practiceDayAlreadyRecorded) {
        console.log("[recordPracticeSession] Hoy no se ha registrado práctica. Calculando nueva racha...");
        const lastPracticeDateJS = lastPracticeDate instanceof Timestamp ? lastPracticeDate.toDate() : (lastPracticeDate ? new Date(lastPracticeDate) : null);
        
        if (lastPracticeDateJS) {
            lastPracticeDateJS.setHours(0,0,0,0); // Normalizar última fecha de práctica
            console.log(`[recordPracticeSession] Última fecha de práctica (normalizada): ${lastPracticeDateJS.toISOString()}`);
            
            const yesterday = new Date(today); 
            yesterday.setDate(today.getDate() - 1); // Ya está normalizada porque 'today' lo está
            console.log(`[recordPracticeSession] Ayer (calculado desde 'today' normalizado): ${yesterday.toISOString()}`);

            if (lastPracticeDateJS.getTime() === yesterday.getTime()) {
                currentStreak += 1; 
                console.log("[recordPracticeSession] Racha continuada. Nueva racha actual:", currentStreak);
            } else if (lastPracticeDateJS.getTime() !== today.getTime()) { // Si no fue ayer Y no fue hoy (ya cubierto por !practiceDayAlreadyRecorded)
                currentStreak = 1; // Racha rota
                console.log("[recordPracticeSession] Racha rota o primera práctica después de un espacio. Nueva racha actual:", currentStreak);
            } else {
                // Si lastPracticeDateJS es hoy, no debería llegar aquí debido a !practiceDayAlreadyRecorded
                // Pero si llegara, significa que la racha continúa y no se incrementa dos veces.
                 console.log("[recordPracticeSession] Última práctica fue hoy (no debería llegar aquí), racha no cambia explícitamente aquí:", currentStreak);
            }
        } else { 
            currentStreak = 1; // Primera práctica registrada
            console.log("[recordPracticeSession] Primera práctica registrada. Nueva racha actual:", currentStreak);
        }
        
        if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
            console.log("[recordPracticeSession] Nueva racha más larga:", longestStreak);
        }
        
        // Añadir hoy solo si no estaba ya (asegurado por !practiceDayAlreadyRecorded)
        completedDatesJS.push(new Date(today.getTime())); // Añadir copia de 'today'
        console.log("[recordPracticeSession] Hoy añadido a completedDatesJS. Nuevo array:", completedDatesJS.map(d => d.toISOString()));
    } else {
      console.log("[recordPracticeSession] Ya se practicó hoy. Racha no modificada. Solo se actualizará el total de preguntas y el progreso diario.");
    }
    
    summaryTotalQuestions += questionsAnsweredCorrectly; 
    console.log("[recordPracticeSession] Total de preguntas respondidas actualizado:", summaryTotalQuestions);

    // Preparar datos para escribir en Firestore
    const dataForSummary = {
      currentStreak,
      longestStreak,
      totalQuestionsAnswered: summaryTotalQuestions,
      lastPracticeDate: Timestamp.fromDate(today), // Guardar como Timestamp
      completedDates: completedDatesJS.map(d => Timestamp.fromDate(d)) // Guardar como array de Timestamps
    };
    console.log("[recordPracticeSession] Datos para escribir en el resumen de racha (streaks/summary):", JSON.stringify(dataForSummary, null, 2));
    batch.set(streakSummaryRef, dataForSummary, { merge: true }); 

    // Manejar progreso diario
    const dailyProgressSnap = await getDoc(dailyRecordRef);
    const existingDailyQuestions = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.questionsAnswered : 0;
    const existingTopics = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.topics : [];
    
    const updatedTopics = Array.from(new Set([...existingTopics, ...topicsCovered]));
    
    const dataForDaily = {
      questionsAnswered: existingDailyQuestions + questionsAnsweredCorrectly,
      topics: updatedTopics, 
      date: Timestamp.fromDate(today), // Guardar como Timestamp
    };
    console.log("[recordPracticeSession] Datos para escribir en el progreso diario (dailyProgress):", JSON.stringify(dataForDaily, null, 2));
    batch.set(dailyRecordRef, dataForDaily, { merge: true });

    await batch.commit();
    console.log("[recordPracticeSession] Batch commit exitoso.");

    return { success: "¡Sesión de práctica registrada!" };
  } catch (error: any) {
    console.error("[recordPracticeSession] Error durante la operación:", error);
     if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      return { 
          error: `Error al registrar la sesión: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan escribir en las subcolecciones '/users/${userId}/streaks/summary' Y '/users/${userId}/dailyProgress/{dateId}'. La regla común para subcolecciones es 'allow write: if request.auth.uid == userId;' dentro de 'match /users/${userId}'. (Código: ${error.code})`
        };
    }
    return { error: `Error al registrar la sesión: ${error.message}` };
  }
}

export async function getStudyStreakData(userId: string): Promise<StreakData> {
  console.log(`[getStudyStreakData] Intentando obtener datos de racha para userId: ${userId}`);
  try {
    const streakSummaryRef = doc(db, "users", userId, "streaks", "summary");
    const summarySnap = await getDoc(streakSummaryRef);

    if (summarySnap.exists()) {
      const data = summarySnap.data();
      // Convertir Timestamps a Date para el cliente
      const completedDatesJS = (data.completedDates || []).map((ts: Timestamp) => {
        const date = ts.toDate();
        date.setHours(0,0,0,0); // Normalizar al inicio del día para consistencia
        return date;
      });
      
      const streakData: StreakData = {
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        totalQuestionsAnswered: data.totalQuestionsAnswered || 0,
        completedDates: completedDatesJS,
      };
      console.log(`[getStudyStreakData] Datos de racha encontrados para ${userId}:`, streakData);
      return streakData;
    } else {
      console.log(`[getStudyStreakData] No se encontró resumen de racha para ${userId}. Devolviendo valores por defecto.`);
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalQuestionsAnswered: 0,
        completedDates: [],
      };
    }
  } catch (error: any) {
    console.error(`[getStudyStreakData] Error al obtener datos de racha para ${userId}:`, error);
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
        console.error(`[getStudyStreakData] PERMISO DENEGADO al leer '/users/${userId}/streaks/summary'. Revisa tus reglas de seguridad.`);
    }
    // Devolver valores por defecto en caso de error para no romper la UI
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalQuestionsAnswered: 0,
      completedDates: [],
    };
  }
}
    

    