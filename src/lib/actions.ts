
"use server";

// =========================================================================================
// ¡¡¡ ATENCIÓN DESARROLLADOR: ESTE MENSAJE ES IMPORTANTE !!!
//
// SI VES UN ERROR EN LA CONSOLA DEL NAVEGADOR (PROVENIENTE DE AuthContext.tsx) QUE DICE:
// "[ALERTA CRÍTICA DE PERMISOS DE FIRESTORE... La aplicación NO PUEDE LEER el perfil...]"
// O SI ALGUNA OPERACIÓN DE ESCRITURA FALLA CON "PERMISSION_DENIED" O "PERMISOS DENEGADOS",
//
// SIGNIFICA QUE TUS REGLAS DE SEGURIDAD DE FIRESTORE SON INCORRECTAS.
// DEBES IR A TU CONSOLA DE FIREBASE -> Firestore Database -> Rules (Reglas)
// Y ASEGURARTE DE QUE LAS REGLAS PARA LA COLECCIÓN AFECTADA (ej: 'users', 'questions')
// PERMITAN LA OPERACIÓN ESPECÍFICA ('read', 'create', 'update') PARA EL USUARIO AUTENTICADO.
//
// EJEMPLO PARA /users/{userId}:
//   match /users/{userId} {
//     allow read: if request.auth.uid == userId; // Para leer perfiles
//     allow create: if request.auth.uid == userId; // Para crear perfiles al registrarse
//     allow update: if request.auth.uid == userId; // Para actualizar perfiles
//   }
//
// ESTE CÓDIGO DE LA APLICACIÓN NO PUEDE SOLUCIONAR UN PROBLEMA DE PERMISOS.
// LA CORRECCIÓN DEBE HACERSE EN TUS REGLAS DE SEGURIDAD EN FIREBASE.
// =========================================================================================

import { db } from "@/lib/firebaseConfig"; // No necesitas auth aquí si no haces operaciones de Auth
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, getDocs, writeBatch, Timestamp, limit } from "firebase/firestore";
import { z } from "zod";
import type { UserProfile, StreakData, Question } from "@/types";


export async function getUserProfile(userId: string): Promise<{ success: boolean, data?: UserProfile, error?: string }> {
  // =========================================================================================
  // ¡¡¡ DIAGNÓSTICO DE PERMISOS DE LECTURA DE PERFIL !!!
  // Si esta función falla con "permission-denied", significa que tus reglas de Firestore
  // NO PERMITEN LEER el documento '/users/{userId}'.
  // La regla necesaria en Firestore (Consola de Firebase -> Firestore Database -> Rules) es:
  //
  // rules_version = '2';
  // service cloud.firestore {
  //   match /databases/{database}/documents {
  //     match /users/{userId} {
  //       // PERMITE LEER el propio documento si está autenticado y el UID coincide
  //       allow read: if request.auth.uid == userId;
  //       // ... (otras reglas como create, update, delete)
  //     }
  //   }
  // }
  // =========================================================================================
  const collectionName = "users";
  console.log(`[getUserProfile Server Action] Attempting to get profile for userId: ${userId} from collection '${collectionName}'`);
  try {
    const userDocRef = doc(db, collectionName, userId);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const profileData: UserProfile = {
        ...data,
        uid: userId,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined),
        lastLoginAt: data.lastLoginAt instanceof Timestamp ? data.lastLoginAt.toDate() : (data.lastLoginAt ? new Date(data.lastLoginAt) : undefined),
        lastUpdatedAt: data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt.toDate() : (data.lastUpdatedAt ? new Date(data.lastUpdatedAt) : undefined),
        age: data.age === undefined || data.age === null ? '' : Number(data.age),
        gender: data.gender === undefined || data.gender === null ? '' : String(data.gender),
      };
      console.log(`[getUserProfile Server Action] Profile found for ${userId}:`, JSON.stringify(profileData, null, 2));
      return { success: true, data: profileData };
    } else {
      console.warn(`[getUserProfile Server Action] Perfil de usuario no encontrado en Firestore para UID: ${userId} en colección '${collectionName}'`);
      return { success: false, error: "Perfil de usuario no encontrado." };
    }
  } catch (error: any) {
    console.error(`[getUserProfile Server Action] Error al obtener el perfil para ${userId} de '${collectionName}':`, error);
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
  const collectionName = "users";
  const PracticeTimeSchema = z.object({
    practiceTime: z.coerce.number().min(5, "El tiempo de práctica debe ser de al menos 5 minutos por día."),
  });

  const validatedFields = PracticeTimeSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Tiempo de práctica inválido." };
  }

  const { practiceTime } = validatedFields.data;
  const pathIntentado = `/${collectionName}/${userId}`;
  console.log(`[savePracticeTime Server Action] Intentando actualizar practiceTime para userId: ${userId} en la ruta: ${pathIntentado}`);

  try {
    const userDocRef = doc(db, collectionName, userId); 
    await updateDoc(userDocRef, { practiceTime, lastUpdatedAt: serverTimestamp() });
    return { success: "¡Tiempo de práctica guardado!" };
  } catch (error: any) {
    console.error(`[savePracticeTime Server Action] Error al guardar el tiempo de práctica para ${userId} en ${pathIntentado}:`, error);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      return {
        error: `Error al guardar el tiempo de práctica: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore permitan la operación 'update' en el documento '/${collectionName}/${userId}' para el usuario autenticado. La regla común es 'allow update: if request.auth.uid == userId;' dentro de 'match /${collectionName}/{userId} { ... }'. (Código: ${error.code})`
      };
    }
    return { error: `Error al guardar el tiempo de práctica: ${error.message}` };
  }
}

export async function updateUserProfile(userId: string, values: Partial<UserProfile>) {
  const collectionName = "users";
  const dataToUpdate: { [key: string]: any } = {};

  // Solo añade campos si están definidos en 'values' para permitir actualizaciones parciales
  if (values.fullName !== undefined) dataToUpdate.fullName = values.fullName === "" ? null : values.fullName;
  if (values.age !== undefined) dataToUpdate.age = values.age === '' || values.age === null ? null : Number(values.age);
  if (values.gender !== undefined) dataToUpdate.gender = values.gender === "" || values.gender === null ? null : values.gender;
  if (values.practiceTime !== undefined) dataToUpdate.practiceTime = Number(values.practiceTime);


  if (Object.keys(dataToUpdate).length === 0) {
    return { success: "No hay cambios para actualizar." };
  }
  dataToUpdate.lastUpdatedAt = serverTimestamp();

  const pathIntentado = `/${collectionName}/${userId}`;
  console.log(`[updateUserProfile Server Action] Intentando actualizar perfil para userId: ${userId} en la ruta: ${pathIntentado} con datos:`, dataToUpdate);

  try {
    const userDocRef = doc(db, collectionName, userId);
    await updateDoc(userDocRef, dataToUpdate);
    console.log(`[updateUserProfile Server Action] Perfil actualizado exitosamente para ${userId}.`);
    return { success: "¡Perfil actualizado correctamente!" };
  } catch (error: any) {
    console.error(`[updateUserProfile Server Action] Error al actualizar el perfil para ${userId} en ${pathIntentado}:`, error);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      return {
        error: `Error al actualizar el perfil: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan la operación 'update' en el documento '/${collectionName}/${userId}' para el usuario autenticado. La regla común es 'allow update: if request.auth.uid == userId;' dentro de 'match /${collectionName}/{userId} { ... }'. (Código: ${error.code})`
      };
    }
    return { error: `Error al actualizar el perfil: ${error.message}` };
  }
}

const exampleQuestionsData: Question[] = [
  { id: "geo1", topic: "Geografía Mundial", question: "¿Cuál es el río más largo del mundo?", options: ["Amazonas", "Nilo", "Yangtsé", "Misisipi"], correctAnswer: "Amazonas" },
  { id: "sci1", topic: "Ciencia Elemental", question: "¿Cuál es el símbolo químico del oro?", options: ["Ag", "Au", "Pb", "Fe"], correctAnswer: "Au" },
];

export async function getPracticeQuestions(): Promise<Question[]> {
  const collectionName = "questions";
  console.log(`[getPracticeQuestions Server Action] Intentando obtener preguntas de Firestore de la colección '${collectionName}'...`);
  try {
    const questionsColRef = collection(db, collectionName);
    const q = query(questionsColRef, limit(50)); // Limitar a 50 para evitar cargar demasiadas
    const querySnapshot = await getDocs(q);

    const allQuestions: Question[] = [];
    querySnapshot.forEach((docSnap) => {
      allQuestions.push({ id: docSnap.id, ...docSnap.data() } as Question);
    });

    if (allQuestions.length === 0) {
      console.warn(`[getPracticeQuestions Server Action] No se encontraron preguntas en Firestore en '${collectionName}'. Devolviendo preguntas de ejemplo.`);
      return exampleQuestionsData;
    }

    // Mezclar y seleccionar hasta 5 preguntas
    const shuffledQuestions = allQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffledQuestions.slice(0, Math.min(5, shuffledQuestions.length));

    console.log(`[getPracticeQuestions Server Action] Seleccionadas ${selectedQuestions.length} preguntas de ${allQuestions.length} disponibles en Firestore ('${collectionName}').`);
    return selectedQuestions;

  } catch (error: any) {
    console.error(`[getPracticeQuestions Server Action] Error al obtener preguntas de práctica de Firestore desde '${collectionName}':`, error);
    if (error.code === 'unavailable') {
      console.error(`[getPracticeQuestions Server Action] Error de Firestore (Código: ${error.code}): ${UNAVAILABLE_ERROR_MESSAGE}`);
    } else if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      console.error(`[getPracticeQuestions Server Action] PERMISO DENEGADO al leer la colección '${collectionName}'. Revisa tus reglas de seguridad de Firestore. La regla necesaria es 'allow read: if request.auth.uid != null;' en la ruta 'match /${collectionName}/{questionId} { ... }'.`);
    }
    console.warn(`[getPracticeQuestions Server Action] Devolviendo preguntas de ejemplo debido a un error al leer '${collectionName}'.`);
    return exampleQuestionsData;
  }
}

export async function recordPracticeSession(userId: string, questionsAnsweredCorrectly: number, topicsCovered: string[]) {
  const userCollectionName = "users";
  const actionName = "[recordPracticeSession Server Action]";
  
  console.log(`${actionName} INICIO para userId: ${userId}, preguntasCorrectas: ${questionsAnsweredCorrectly}, temas:`, topicsCovered);

  if (!userId) {
    console.error(`${actionName} Error: Falta userId.`);
    return { error: "ID de usuario faltante." };
  }

  if (questionsAnsweredCorrectly <= 0) {
    console.log(`${actionName} No se respondieron preguntas correctamente (<=0), no se actualiza la racha ni el progreso diario.`);
    return { success: "No hay preguntas correctas para actualizar la racha." };
  }

  try {
    const todayNormalized = new Date();
    todayNormalized.setHours(0, 0, 0, 0);
    console.log(`${actionName} Fecha de hoy (normalizada): ${todayNormalized.toISOString()}`);

    const streakSummaryPath = `${userCollectionName}/${userId}/streaks/summary`;
    const streakSummaryRef = doc(db, streakSummaryPath);
    
    const todayDateStr = `${todayNormalized.getFullYear()}-${String(todayNormalized.getMonth() + 1).padStart(2, '0')}-${String(todayNormalized.getDate()).padStart(2, '0')}`;
    const dailyRecordPath = `${userCollectionName}/${userId}/dailyProgress/${todayDateStr}`;
    const dailyRecordRef = doc(db, dailyRecordPath);

    const batch = writeBatch(db);

    console.log(`${actionName} Intentando LEER el resumen de racha desde: ${streakSummaryPath}`);
    const summarySnap = await getDoc(streakSummaryRef);
    
    let currentStreak = 0;
    let longestStreak = 0;
    let summaryTotalQuestions = 0;
    let lastPracticeDate FirestoreTimestamp: Timestamp | null = null;
    let completedDates FirestoreTimestamps: Timestamp[] = [];

    if (summarySnap.exists()) {
      const data = summarySnap.data();
      currentStreak = data.currentStreak || 0;
      longestStreak = data.longestStreak || 0;
      summaryTotalQuestions = data.totalQuestionsAnswered || 0;
      lastPracticeDateFirestoreTimestamp = data.lastPracticeDate instanceof Timestamp ? data.lastPracticeDate : null;
      completedDatesFirestoreTimestamps = Array.isArray(data.completedDates) ? data.completedDates.filter((d: any): d is Timestamp => d instanceof Timestamp) : [];
      console.log(`${actionName} Datos de racha LEÍDOS: current=${currentStreak}, longest=${longestStreak}, totalQ=${summaryTotalQuestions}, lastPractice=${lastPracticeDateFirestoreTimestamp?.toDate().toISOString()}, completedDatesCount=${completedDatesFirestoreTimestamps.length}`);
    } else {
      console.log(`${actionName} No se encontró resumen de racha. Se asumirán valores por defecto (0).`);
    }
    
    // Convertir completedDates de Timestamps a JS Date objects (normalizados) para la lógica
    let completedDatesJS: Date[] = completedDatesFirestoreTimestamps.map(ts => {
      const date = ts.toDate();
      date.setHours(0,0,0,0);
      return date;
    });

    const practiceDayAlreadyRecorded = completedDatesJS.some(d => d.getTime() === todayNormalized.getTime());
    console.log(`${actionName} ¿Día de práctica ya registrado para hoy (${todayNormalized.toISOString()})?: ${practiceDayAlreadyRecorded}`);

    let newCurrentStreak = currentStreak;
    let newLongestStreak = longestStreak;
    let newCompletedDatesJS = [...completedDatesJS]; // Copia para modificar
    let newLastPracticeDateJS = todayNormalized; // Siempre se actualiza a hoy

    if (!practiceDayAlreadyRecorded) {
      console.log(`${actionName} Hoy no se ha registrado práctica. Calculando nueva racha...`);
      const lastPracticeDateJS = lastPracticeDateFirestoreTimestamp ? lastPracticeDateFirestoreTimestamp.toDate() : null;
      if (lastPracticeDateJS) {
        lastPracticeDateJS.setHours(0,0,0,0); // Normalizar
        const yesterdayNormalized = new Date(todayNormalized);
        yesterdayNormalized.setDate(todayNormalized.getDate() - 1);

        if (lastPracticeDateJS.getTime() === yesterdayNormalized.getTime()) {
          newCurrentStreak = currentStreak + 1;
          console.log(`${actionName} Racha continuada. Nueva racha actual: ${newCurrentStreak}`);
        } else { // No fue ayer (y ya sabemos que no es hoy)
          newCurrentStreak = 1;
          console.log(`${actionName} Racha interrumpida o primera racha. Nueva racha actual: ${newCurrentStreak}`);
        }
      } else { // No hay registro de última práctica
        newCurrentStreak = 1;
        console.log(`${actionName} Primera práctica registrada. Racha actual: ${newCurrentStreak}`);
      }

      if (newCurrentStreak > newLongestStreak) {
        newLongestStreak = newCurrentStreak;
        console.log(`${actionName} Nueva racha más larga: ${newLongestStreak}`);
      }
      newCompletedDatesJS.push(new Date(todayNormalized.getTime())); // Añadir hoy (clonado y normalizado)
      console.log(`${actionName} Hoy añadido a completedDates. Total días completados ahora: ${newCompletedDatesJS.length}`);
    } else {
      console.log(`${actionName} Ya se practicó hoy. Racha no modificada. Solo se actualizará el total de preguntas y el progreso diario.`);
    }

    const newSummaryTotalQuestions = summaryTotalQuestions + questionsAnsweredCorrectly;
    console.log(`${actionName} Total de preguntas respondidas actualizado: ${newSummaryTotalQuestions}`);

    const dataForSummary = {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      totalQuestionsAnswered: newSummaryTotalQuestions,
      lastPracticeDate: Timestamp.fromDate(newLastPracticeDateJS), // Guardar como Firestore Timestamp
      completedDates: newCompletedDatesJS.map(d => Timestamp.fromDate(d)) // Guardar como array de Timestamps
    };
    console.log(`${actionName} DATOS PARA ESCRIBIR en resumen de racha ('${streakSummaryPath}'):`, JSON.stringify(dataForSummary, (key, value) => key === 'completedDates' || key === 'lastPracticeDate' ? (value as any)?.toDate?.().toISOString() || value : value, 2));
    batch.set(streakSummaryRef, dataForSummary, { merge: true });

    // Update daily progress
    console.log(`${actionName} Intentando LEER el progreso diario desde: ${dailyRecordPath}`);
    const dailyProgressSnap = await getDoc(dailyRecordRef);
    const existingDailyQuestions = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.questionsAnswered : 0;
    const existingTopics = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.topics : [];
    const updatedTopics = Array.from(new Set([...existingTopics, ...topicsCovered]));

    const dataForDaily = {
      questionsAnswered: existingDailyQuestions + questionsAnsweredCorrectly,
      topics: updatedTopics,
      date: Timestamp.fromDate(todayNormalized),
    };
    console.log(`${actionName} DATOS PARA ESCRIBIR en progreso diario ('${dailyRecordPath}'):`, dataForDaily);
    batch.set(dailyRecordRef, dataForDaily, { merge: true });

    console.log(`${actionName} Intentando hacer BATCH.COMMIT()`);
    await batch.commit();
    console.log(`${actionName} FIN: Batch commit exitoso para UID: ${userId}.`);
    return { success: "¡Sesión de práctica registrada!" };

  } catch (error: any) {
    console.error(`${actionName} ERROR durante la operación para UID: ${userId}:`, error);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      // Mensaje de error corregido para guiar sobre las reglas de las subcolecciones
      const specificPathAttempt = `${userCollectionName}/${userId}/streaks/summary o ${userCollectionName}/${userId}/dailyProgress/{dateId}`;
      return {
        error: `Error al registrar la sesión: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan escribir ('allow write: if request.auth.uid == userId;') en las subcolecciones: '/${userCollectionName}/{userId}/streaks/summary' Y '/${userCollectionName}/{userId}/dailyProgress/{dateId}'. Esto se configura dentro de 'match /${userCollectionName}/{userId} { match /streaks/summary { ... } match /dailyProgress/{dateId} { ... } }'. (Código: ${error.code})`
      };
    }
    return { error: `Error al registrar la sesión: ${error.message}` };
  }
}

export async function getStudyStreakData(userId: string): Promise<StreakData> {
  const collectionName = "users";
  const actionName = "[getStudyStreakData Server Action]";
  const streakSummaryPath = `${collectionName}/${userId}/streaks/summary`;
  console.log(`${actionName} Intentando obtener datos de racha para userId: ${userId} desde '${streakSummaryPath}'`);
  try {
    const streakSummaryRef = doc(db, streakSummaryPath);
    const summarySnap = await getDoc(streakSummaryRef);

    if (summarySnap.exists()) {
      const data = summarySnap.data();
      const completedDatesFirestoreTimestamps = Array.isArray(data.completedDates) ? data.completedDates.filter((d: any): d is Timestamp => d instanceof Timestamp) : [];
      
      const completedDatesJS = completedDatesFirestoreTimestamps.map((ts: Timestamp) => {
        const date = ts.toDate();
        date.setHours(0, 0, 0, 0); // Normalizar a la medianoche
        return date;
      });

      console.log(`${actionName} completedDatesJS convertidas (primeras 5):`, completedDatesJS.slice(0,5).map(d => d.toISOString()));

      const streakDataResult: StreakData = {
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        totalQuestionsAnswered: data.totalQuestionsAnswered || 0,
        completedDates: completedDatesJS,
      };
      console.log(`${actionName} Datos de racha encontrados y procesados para ${userId}.`);
      return streakDataResult;
    } else {
      console.log(`${actionName} No se encontró resumen de racha para ${userId}. Devolviendo valores por defecto.`);
      return { currentStreak: 0, longestStreak: 0, totalQuestionsAnswered: 0, completedDates: [] };
    }
  } catch (error: any) {
    console.error(`${actionName} Error al obtener datos de racha para ${userId} desde '${streakSummaryPath}':`, error);
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      console.error(`${actionName} PERMISO DENEGADO al leer '${streakSummaryPath}'. Revisa tus reglas de seguridad de Firestore.`);
    }
    return { currentStreak: 0, longestStreak: 0, totalQuestionsAnswered: 0, completedDates: [] };
  }
}
