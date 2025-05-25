
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

import { db } from "@/lib/firebaseConfig"; 
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, getDocs, writeBatch, Timestamp, limit } from "firebase/firestore";
import { z } from "zod";
import type { UserProfile, StreakData } from "@/types";
import type { Question } from "@/components/practice/QuestionCard";


// =========================================================================================
// ¡¡¡ DIAGNÓSTICO DE PERMISOS DE LECTURA DE PERFIL !!!
// Esta función es llamada por AuthContext en el CLIENTE a través de getDoc, no como una Server Action.
// Los errores de permisos aquí significan que las REGLAS DE SEGURIDAD de Firestore
// no permiten 'read' en '/users/{userId}' para el usuario autenticado.
//
// REGLA NECESARIA EN FIRESTORE CONSOLE (Firestore Database -> Rules):
// match /users/{userId} {
//   allow read: if request.auth.uid == userId;
//   // ... otras reglas para create, update, delete ...
// }
// =========================================================================================
export async function getUserProfile(userId: string): Promise<{ success: boolean, data?: UserProfile, error?: string }> {
  const collectionName = "users";
  console.log(`[getUserProfile Client-Side Call from AuthContext] Attempting to get profile for userId: ${userId} from collection '${collectionName}'`);
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
      console.log(`[getUserProfile Client-Side Call from AuthContext] Profile found for ${userId}.`);
      return { success: true, data: profileData };
    } else {
      console.warn(`[getUserProfile Client-Side Call from AuthContext] Perfil de usuario no encontrado en Firestore para UID: ${userId} en colección '${collectionName}'`);
      return { success: false, error: "Perfil de usuario no encontrado." };
    }
  } catch (error: any) {
    console.error(`[getUserProfile Client-Side Call from AuthContext] Error al obtener el perfil para ${userId} de '${collectionName}':`, error.message, error.code);
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
  const userDocPath = `${collectionName}/${userId}`; 
  console.log(`[savePracticeTime Server Action] Intentando actualizar practiceTime para userId: ${userId} en la ruta: /${userDocPath}`);

  try {
    const userDocRef = doc(db, collectionName, userId); 
    await updateDoc(userDocRef, { practiceTime, lastUpdatedAt: serverTimestamp() });
    console.log(`[savePracticeTime Server Action] Tiempo de práctica guardado exitosamente para ${userId}.`);
    return { success: "¡Tiempo de práctica guardado!" };
  } catch (error: any) {
    console.error(`[savePracticeTime Server Action] Error al guardar el tiempo de práctica para ${userId} en /${userDocPath}:`, error.message, error.code);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      return {
        error: `Error al guardar el tiempo de práctica: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore permitan la operación 'update' en el documento '/${userDocPath}' para el usuario autenticado. La regla común es 'allow update: if request.auth.uid == userId;' dentro de 'match /${collectionName}/{userId} { ... }'. (Código: ${error.code})`
      };
    }
    return { error: `Error al guardar el tiempo de práctica: ${error.message}` };
  }
}

export async function updateUserProfile(userId: string, values: Partial<UserProfile>) {
  const collectionName = "users";
  const dataToUpdate: { [key: string]: any } = {};

  if (values.fullName !== undefined) dataToUpdate.fullName = values.fullName === "" ? null : values.fullName;
  if (values.age !== undefined) {
    dataToUpdate.age = values.age === '' || values.age === null ? null : Number(values.age);
  }
  if (values.gender !== undefined) dataToUpdate.gender = values.gender === "" || values.gender === null ? null : values.gender;
  if (values.practiceTime !== undefined) dataToUpdate.practiceTime = Number(values.practiceTime);

  if (Object.keys(dataToUpdate).length === 0) {
    return { success: "No hay cambios para actualizar." };
  }
  dataToUpdate.lastUpdatedAt = serverTimestamp();

  const userDocPath = `${collectionName}/${userId}`; 
  console.log(`[updateUserProfile Server Action] Intentando actualizar perfil para userId: ${userId} en la ruta: /${userDocPath} con datos:`, dataToUpdate);

  try {
    const userDocRef = doc(db, collectionName, userId);
    await updateDoc(userDocRef, dataToUpdate);
    console.log(`[updateUserProfile Server Action] Perfil actualizado exitosamente para ${userId}.`);
    return { success: "¡Perfil actualizado correctamente!" };
  } catch (error: any) {
    console.error(`[updateUserProfile Server Action] Error al actualizar el perfil para ${userId} en /${userDocPath}:`, error.message, error.code);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      return {
        error: `Error al actualizar el perfil: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan la operación 'update' en el documento '/${userDocPath}' para el usuario autenticado. La regla común es 'allow update: if request.auth.uid == userId;' dentro de 'match /${collectionName}/{userId} { ... }'. (Código: ${error.code})`
      };
    }
    return { error: `Error al actualizar el perfil: ${error.message}` };
  }
}

const exampleQuestionsData: Question[] = [
  { id: "geo1", topic: "Geografía Mundial", question: "¿Cuál es el río más largo del mundo?", options: ["Amazonas", "Nilo", "Yangtsé", "Misisipi"], correctAnswer: "Amazonas" },
  { id: "sci1", topic: "Ciencia Elemental", question: "¿Cuál es el símbolo químico del oro?", options: ["Ag", "Au", "Pb", "Fe"], correctAnswer: "Au" },
  { id: "his1", topic: "Historia Universal", question: "¿En qué año comenzó la Primera Guerra Mundial?", options: ["1912", "1914", "1916", "1918"], correctAnswer: "1914" },
  { id: "lit1", topic: "Literatura Clásica", question: "¿Quién escribió 'Don Quijote de la Mancha'?", options: ["Miguel de Cervantes", "Lope de Vega", "Calderón de la Barca", "Garcilaso de la Vega"], correctAnswer: "Miguel de Cervantes" },
  { id: "art1", topic: "Arte Renacentista", question: "¿Quién pintó la 'Mona Lisa'?", options: ["Leonardo da Vinci", "Miguel Ángel", "Rafael Sanzio", "Sandro Botticelli"], correctAnswer: "Leonardo da Vinci" },
];

export async function getPracticeQuestions(): Promise<Question[]> {
  const collectionName = "questions";
  console.log(`[getPracticeQuestions Server Action] Intentando obtener preguntas de Firestore de la colección '${collectionName}'...`);
  try {
    const questionsColRef = collection(db, collectionName);
    const q = query(questionsColRef, limit(50)); 
    const querySnapshot = await getDocs(q);

    const allQuestions: Question[] = [];
    querySnapshot.forEach((docSnap) => {
      allQuestions.push({ id: docSnap.id, ...docSnap.data() } as Question);
    });

    if (allQuestions.length === 0) {
      console.warn(`[getPracticeQuestions Server Action] No se encontraron preguntas en Firestore en '${collectionName}'. Devolviendo preguntas de ejemplo.`);
      return exampleQuestionsData; 
    }

    const shuffledQuestions = allQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffledQuestions.slice(0, Math.min(5, shuffledQuestions.length));

    console.log(`[getPracticeQuestions Server Action] Seleccionadas ${selectedQuestions.length} preguntas de ${allQuestions.length} disponibles en Firestore ('${collectionName}').`);
    return selectedQuestions;

  } catch (error: any) {
    console.error(`[getPracticeQuestions Server Action] Error al obtener preguntas de práctica de Firestore desde '${collectionName}':`, error.message, error.code);
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
  
  const todayNormalized = new Date();
  todayNormalized.setHours(0, 0, 0, 0);
  const todayDateStr = `${todayNormalized.getFullYear()}-${String(todayNormalized.getMonth() + 1).padStart(2, '0')}-${String(todayNormalized.getDate()).padStart(2, '0')}`;

  console.log(`${actionName} INICIO para userId: ${userId}, preguntasCorrectas: ${questionsAnsweredCorrectly}, temas:`, topicsCovered);
  console.log(`${actionName} Fecha de hoy (normalizada para cálculos): ${todayNormalized.toISOString()}`);
  console.log(`${actionName} String de fecha de hoy (para ID de documento de progreso diario): ${todayDateStr}`);

  if (!userId) {
    console.error(`${actionName} Error: Falta userId.`);
    return { error: "ID de usuario faltante." };
  }

  if (questionsAnsweredCorrectly <= 0) {
    console.log(`${actionName} No se respondieron preguntas correctamente (<=0), no se actualiza la racha ni el progreso diario.`);
    return { success: "No hay preguntas correctas para actualizar la racha." };
  }

  const streakSummaryPath = `${userCollectionName}/${userId}/streaks/summary`;
  const dailyRecordPath = `${userCollectionName}/${userId}/dailyProgress/${todayDateStr}`;
  console.log(`${actionName} Ruta para resumen de racha: ${streakSummaryPath}`);
  console.log(`${actionName} Ruta para progreso diario: ${dailyRecordPath}`);

  try {
    const streakSummaryRef = doc(db, streakSummaryPath);
    const dailyRecordRef = doc(db, dailyRecordPath);
    const batch = writeBatch(db);

    console.log(`${actionName} Intentando LEER el resumen de racha desde: ${streakSummaryPath}`);
    const summarySnap = await getDoc(streakSummaryRef);
    
    let currentStreak = 0;
    let longestStreak = 0;
    let summaryTotalQuestions = 0;
    let lastPracticeDateFirestoreTimestamp: Timestamp | null = null;
    let completedDatesFirestoreTimestamps: Timestamp[] = [];

    if (summarySnap.exists()) {
      const data = summarySnap.data();
      currentStreak = data.currentStreak || 0;
      longestStreak = data.longestStreak || 0;
      summaryTotalQuestions = data.totalQuestionsAnswered || 0;
      lastPracticeDateFirestoreTimestamp = data.lastPracticeDate instanceof Timestamp ? data.lastPracticeDate : null;
      completedDatesFirestoreTimestamps = Array.isArray(data.completedDates) ? data.completedDates.filter((d: any): d is Timestamp => d instanceof Timestamp) : [];
      console.log(`${actionName} Datos de racha LEÍDOS: current=${currentStreak}, longest=${longestStreak}, totalQ=${summaryTotalQuestions}, lastPractice=${lastPracticeDateFirestoreTimestamp?.toDate().toISOString()}, completedDatesCount=${completedDatesFirestoreTimestamps.length}`);
    } else {
      console.log(`${actionName} No se encontró resumen de racha en ${streakSummaryPath}. Se asumirán valores por defecto (0).`);
    }
    
    let completedDatesJS: Date[] = completedDatesFirestoreTimestamps.map(ts => {
      const date = ts.toDate();
      date.setHours(0,0,0,0); 
      return date;
    });

    const practiceDayAlreadyRecorded = completedDatesJS.some(d => d.getTime() === todayNormalized.getTime());
    console.log(`${actionName} ¿Día de práctica ya registrado para hoy (${todayNormalized.toISOString()})?: ${practiceDayAlreadyRecorded}`);

    let newCurrentStreak = currentStreak;
    let newLongestStreak = longestStreak;
    let newCompletedDatesJS = [...completedDatesJS]; 
    let newLastPracticeDateJS = new Date(todayNormalized.getTime()); 

    if (!practiceDayAlreadyRecorded) {
      console.log(`${actionName} Hoy no se ha registrado práctica. Calculando nueva racha...`);
      const lastPracticeDateJS = lastPracticeDateFirestoreTimestamp ? lastPracticeDateFirestoreTimestamp.toDate() : null;
      if (lastPracticeDateJS) {
        lastPracticeDateJS.setHours(0,0,0,0); 
        const yesterdayNormalized = new Date(todayNormalized); 
        yesterdayNormalized.setDate(todayNormalized.getDate() - 1);
        yesterdayNormalized.setHours(0,0,0,0); 

        console.log(`${actionName} Comparando: lastPracticeDateJS=${lastPracticeDateJS.toISOString()}, yesterdayNormalized=${yesterdayNormalized.toISOString()}`);

        if (lastPracticeDateJS.getTime() === yesterdayNormalized.getTime()) {
          newCurrentStreak = currentStreak + 1;
          console.log(`${actionName} Racha continuada. Nueva racha actual: ${newCurrentStreak}`);
        } else { 
          newCurrentStreak = 1; 
          console.log(`${actionName} Racha interrumpida. Nueva racha actual: ${newCurrentStreak}`);
        }
      } else { 
        newCurrentStreak = 1; 
        console.log(`${actionName} Primera práctica registrada. Racha actual: ${newCurrentStreak}`);
      }

      if (newCurrentStreak > newLongestStreak) {
        newLongestStreak = newCurrentStreak;
        console.log(`${actionName} Nueva racha más larga: ${newLongestStreak}`);
      }
      newCompletedDatesJS.push(new Date(todayNormalized.getTime())); 
      console.log(`${actionName} Hoy añadido a completedDates. Total días completados ahora: ${newCompletedDatesJS.length}, nueva fecha: ${todayNormalized.toISOString()}`);
    } else {
      console.log(`${actionName} Ya se practicó hoy. Racha no modificada. Solo se actualizará el total de preguntas y el progreso diario.`);
    }

    const newSummaryTotalQuestions = summaryTotalQuestions + questionsAnsweredCorrectly;
    console.log(`${actionName} Total de preguntas respondidas actualizado: ${newSummaryTotalQuestions}`);

    const uniqueCompletedDatesTimestamps = Array.from(new Set(newCompletedDatesJS.map(d => d.getTime())))
                                          .map(time => Timestamp.fromDate(new Date(time)));

    const dataForSummary = {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      totalQuestionsAnswered: newSummaryTotalQuestions,
      lastPracticeDate: Timestamp.fromDate(newLastPracticeDateJS), 
      completedDates: uniqueCompletedDatesTimestamps 
    };

    console.log(`${actionName} DATOS PARA ESCRIBIR en resumen de racha ('${streakSummaryPath}'):`, JSON.stringify(dataForSummary, (key, value) => {
      if (value instanceof Timestamp) return value.toDate().toISOString();
      if (Array.isArray(value) && value.every(item => item instanceof Timestamp)) return value.map(ts => ts.toDate().toISOString());
      return value;
    }, 2));
    batch.set(streakSummaryRef, dataForSummary, { merge: true });

    console.log(`${actionName} Intentando LEER el progreso diario desde: ${dailyRecordPath}`);
    const dailyProgressSnap = await getDoc(dailyRecordRef);
    const existingDailyQuestions = dailyProgressSnap.exists() ? (dailyProgressSnap.data()!.questionsAnswered || 0) : 0;
    const existingTopics = dailyProgressSnap.exists() ? (dailyProgressSnap.data()!.topics || []) : [];
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
    console.error(`${actionName} ERROR durante la operación para UID: ${userId}:`, error.message, error.code);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      const specificPathAttempt = `users/${userId}/streaks/summary O users/${userId}/dailyProgress/${todayDateStr}`;
      return {
        // Corrección en el mensaje de guía: userId y dateId
        error: `Error al registrar la sesión: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan escribir ('allow write: if request.auth.uid == userId;') en las subcolecciones: '${specificPathAttempt}'. Esto se configura dentro de 'match /users/{userId} { match /streaks/summary { ... } match /dailyProgress/{dateId} { ... } }'. (Código: ${error.code})`
      };
    }
    return { error: `Error al registrar la sesión: ${error.message}` };
  }
}

export async function getStudyStreakData(userId: string): Promise<StreakData> {
  const userCollectionName = "users";
  const actionName = "[getStudyStreakData Server Action]";
  const streakSummaryPath = `${userCollectionName}/${userId}/streaks/summary`;
  console.log(`${actionName} Intentando obtener datos de racha para userId: ${userId} desde '${streakSummaryPath}'`);
  try {
    const streakSummaryRef = doc(db, streakSummaryPath);
    const summarySnap = await getDoc(streakSummaryRef);

    if (summarySnap.exists()) {
      const data = summarySnap.data();
      const completedDatesFirestoreTimestamps: Timestamp[] = Array.isArray(data.completedDates) 
        ? data.completedDates.filter((d: any): d is Timestamp => d instanceof Timestamp) 
        : [];
      
      const completedDatesJS: Date[] = completedDatesFirestoreTimestamps.map((ts: Timestamp) => {
        const date = ts.toDate();
        date.setHours(0, 0, 0, 0); 
        return date;
      });

      console.log(`${actionName} completedDatesJS convertidas (primeras 5 para log):`, completedDatesJS.slice(0,5).map(d => d.toISOString()));

      const streakDataResult: StreakData = {
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        totalQuestionsAnswered: data.totalQuestionsAnswered || 0,
        completedDates: completedDatesJS, 
      };
      console.log(`${actionName} Datos de racha encontrados y procesados para ${userId}:`, streakDataResult);
      return streakDataResult;
    } else {
      console.log(`${actionName} No se encontró resumen de racha para ${userId} en ${streakSummaryPath}. Devolviendo valores por defecto.`);
      return { currentStreak: 0, longestStreak: 0, totalQuestionsAnswered: 0, completedDates: [] };
    }
  } catch (error: any) {
    console.error(`${actionName} Error al obtener datos de racha para ${userId} desde '${streakSummaryPath}':`, error.message, error.code);
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      console.error(`${actionName} PERMISO DENEGADO al leer '${streakSummaryPath}'. Revisa tus reglas de seguridad de Firestore. Necesitas 'allow read: if request.auth.uid == userId;' en 'match /${userCollectionName}/{userId}/streaks/summary'.`);
    }
    return { currentStreak: 0, longestStreak: 0, totalQuestionsAnswered: 0, completedDates: [] };
  }
}

    