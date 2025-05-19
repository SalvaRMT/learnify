
"use server";

import { auth, db } from "@/lib/firebaseConfig";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, getDocs, writeBatch, Timestamp, limit } from "firebase/firestore";
import { z } from "zod";
import type { UserProfile, StreakData, Question } from "@/types";
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";

// =========================================================================================
// ¡¡¡ ATENCIÓN DESARROLLADOR: ESTE MENSAJE ES IMPORTANTE !!!
//
// SI VES UN ERROR EN LA CONSOLA DEL NAVEGADOR (PROVENIENTE DE AuthContext.tsx) QUE DICE:
// "[ALERTA CRÍTICA DE PERMISOS DE FIRESTORE... La aplicación NO PUEDE LEER el perfil...]"
// O SI ALGUNA OPERACIÓN DE ESCRITURA FALLA CON "PERMISSION_DENIED" O "PERMISOS DENEGADOS",
//
// SIGNIFICA QUE TUS REGLAS DE SEGURIDAD DE FIRESTORE SON INCORRECTAS.
// DEBES IR A TU CONSOLA DE FIREBASE -> Firestore Database -> Rules (Reglas)
// Y ASEGURARTE DE QUE LAS REGLAS PARA LA COLECCIÓN 'users' (o como se llame tu colección de usuarios)
// PERMITAN LA OPERACIÓN ESPECÍFICA ('read', 'create', 'update') PARA EL USUARIO AUTENTICADO.
// EJEMPLO PARA /users/{userId}:
//   match /users/{userId} {
//     allow read: if request.auth.uid == userId;
//     allow create: if request.auth.uid == userId;
//     allow update: if request.auth.uid == userId;
//     // ... y también para subcolecciones como streaks/summary y dailyProgress ...
//   }
//
// ESTE CÓDIGO DE LA APLICACIÓN NO PUEDE SOLUCIONAR UN PROBLEMA DE PERMISOS.
// LA CORRECCIÓN DEBE HACERSE EN TUS REGLAS DE SEGURIDAD EN FIREBASE.
// =========================================================================================
export async function getUserProfile(userId: string): Promise<{ success: boolean, data?: UserProfile, error?: string }> {
  const collectionName = "users"; // Asegurarse de que el nombre de la colección es correcto
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
      console.log(`[getUserProfile Server Action] Profile found for ${userId}:`, profileData);
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
    // El mensaje de error crítico sobre permisos ahora se maneja principalmente en AuthContext para la lectura inicial.
    // Pero si se llama directamente, este es un buen fallback.
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      return { success: false, error: "Error al obtener el perfil debido a permisos de Firestore." };
    }
    return { success: false, error: `Error al obtener el perfil: ${error.message}` };
  }
}

const UNAVAILABLE_ERROR_MESSAGE = "Operación fallida. Por favor, verifica tu conexión a internet. Además, asegúrate de que Firestore esté habilitado e inicializado en la consola de tu proyecto de Firebase.";

export async function savePracticeTime(userId: string, values: { practiceTime: number }) {
  const collectionName = "users"; // Nombre de la colección principal de usuarios
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
        error: `Error al guardar el tiempo de práctica: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore permitan la operación 'update' en el documento '${pathIntentado}' para el usuario autenticado. La regla común es 'allow update: if request.auth.uid == userId;' dentro de 'match /${collectionName}/{userId} { ... }'. (Código: ${error.code})`
      };
    }
    return { error: `Error al guardar el tiempo de práctica: ${error.message}` };
  }
}

export async function updateUserProfile(userId: string, values: Partial<UserProfile>) {
  const collectionName = "users"; // Nombre de la colección principal de usuarios
  const dataToUpdate: { [key: string]: any } = {};

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
      // Mensaje de error corregido para usar 'userId' en la guía
      return {
        error: `Error al actualizar el perfil: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan la operación 'update' en el documento '${pathIntentado}' para el usuario autenticado. La regla común es 'allow update: if request.auth.uid == userId;' dentro de 'match /${collectionName}/{userId} { ... }'. (Código: ${error.code})`
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
    const querySnapshot = await getDocs(query(questionsColRef, limit(50)));

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
  const collectionName = "users"; // Nombre de la colección principal de usuarios
  const actionName = "[recordPracticeSession Server Action]";
  console.log(`${actionName} Iniciando para userId: ${userId}, preguntasRespondidasCorrectamente: ${questionsAnsweredCorrectly}, temasCubiertos:`, topicsCovered);

  if (!userId) {
    console.error(`${actionName} Error: Falta userId.`);
    return { error: "ID de usuario faltante." };
  }

  if (questionsAnsweredCorrectly <= 0) {
    console.log(`${actionName} No se respondieron preguntas correctamente, no se actualiza la racha ni el progreso diario.`);
    return { success: "No hay preguntas correctas para actualizar la racha." };
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a la medianoche
    console.log(`${actionName} Fecha de hoy (normalizada): ${today.toISOString()}`);

    const streakSummaryRef = doc(db, collectionName, userId, "streaks", "summary");
    const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dailyRecordRef = doc(db, collectionName, userId, "dailyProgress", todayDateStr);

    const batch = writeBatch(db);

    // Obtener el resumen de la racha existente
    const summarySnap = await getDoc(streakSummaryRef);
    let {
      currentStreak = 0,
      longestStreak = 0,
      totalQuestionsAnswered: summaryTotalQuestions = 0,
      lastPracticeDate, // Firestore Timestamp o undefined
      completedDates = [] // Array de Firestore Timestamps o undefined
    } = summarySnap.exists() ? summarySnap.data() : {};
    
    console.log(`${actionName} Datos de racha leídos de Firestore:`, { currentStreak, longestStreak, summaryTotalQuestions, lastPracticeDate, completedDatesCount: completedDates.length });


    // Convertir Timestamps a objetos Date de JS para la lógica
    let completedDatesJS: Date[] = (Array.isArray(completedDates) ? completedDates : []).map((d: any) => {
        let dateObj: Date | null = null;
        if (d instanceof Timestamp) dateObj = d.toDate();
        else if (d instanceof Date) dateObj = new Date(d.getTime()); // Clonar para evitar mutaciones
        else if (typeof d === 'string' || typeof d === 'number') dateObj = new Date(d);
        
        if (dateObj && !isNaN(dateObj.getTime())) {
            dateObj.setHours(0,0,0,0); // Normalizar
            return dateObj;
        }
        return null;
    }).filter((d): d is Date => d !== null);
    console.log(`${actionName} completedDatesJS (normalizadas y filtradas): ${completedDatesJS.length} fechas`);


    const practiceDayAlreadyRecorded = completedDatesJS.some(d => d.getTime() === today.getTime());
    console.log(`${actionName} ¿Día de práctica ya registrado para hoy (${today.toISOString()})?: ${practiceDayAlreadyRecorded}`);

    if (!practiceDayAlreadyRecorded) {
      console.log(`${actionName} Hoy no se ha registrado práctica. Calculando nueva racha...`);
      const lastPracticeDateJS = lastPracticeDate instanceof Timestamp ? lastPracticeDate.toDate() : (lastPracticeDate ? new Date(lastPracticeDate) : null);

      if (lastPracticeDateJS) {
        lastPracticeDateJS.setHours(0, 0, 0, 0); // Normalizar
        console.log(`${actionName} Última fecha de práctica (normalizada): ${lastPracticeDateJS.toISOString()}`);

        const yesterday = new Date(today); // today ya está normalizada
        yesterday.setDate(today.getDate() - 1);
        // No es necesario normalizar yesterday de nuevo si today lo estaba.
        console.log(`${actionName} Ayer (calculado desde 'today' normalizado): ${yesterday.toISOString()}`);

        if (lastPracticeDateJS.getTime() === yesterday.getTime()) {
          currentStreak += 1;
          console.log(`${actionName} Racha continuada. Nueva racha actual: ${currentStreak}`);
        } else if (lastPracticeDateJS.getTime() !== today.getTime()) { // Si no fue ayer Y no fue hoy (aunque hoy está cubierto por !practiceDayAlreadyRecorded)
          currentStreak = 1;
          console.log(`${actionName} Racha rota o primera práctica después de un espacio. Nueva racha actual: ${currentStreak}`);
        } else {
          console.log(`${actionName} Última práctica fue hoy (no debería llegar aquí), racha no cambia explícitamente aquí: ${currentStreak}`);
        }
      } else {
        currentStreak = 1; // Primera práctica
        console.log(`${actionName} Primera práctica registrada. Nueva racha actual: ${currentStreak}`);
      }

      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
        console.log(`${actionName} Nueva racha más larga: ${longestStreak}`);
      }

      // Añadir la fecha de hoy (ya normalizada) a completedDatesJS
      completedDatesJS.push(new Date(today.getTime())); // Usar una nueva instancia para evitar problemas de referencia
      console.log(`${actionName} Hoy añadido a completedDatesJS. Nuevo array tiene ${completedDatesJS.length} fechas`);
    } else {
      console.log(`${actionName} Ya se practicó hoy. Racha no modificada. Solo se actualizará el total de preguntas y el progreso diario.`);
    }

    summaryTotalQuestions += questionsAnsweredCorrectly;
    console.log(`${actionName} Total de preguntas respondidas actualizado: ${summaryTotalQuestions}`);

    const dataForSummary = {
      currentStreak,
      longestStreak,
      totalQuestionsAnswered: summaryTotalQuestions,
      lastPracticeDate: Timestamp.fromDate(today), // Guardar como Timestamp
      completedDates: completedDatesJS.map(d => Timestamp.fromDate(d)) // Guardar como array de Timestamps
    };
    const streakSummaryPath = `/${collectionName}/${userId}/streaks/summary`;
    console.log(`${actionName} Datos para escribir en el resumen de racha ('${streakSummaryPath}'):`, JSON.stringify(dataForSummary, null, 2));
    batch.set(streakSummaryRef, dataForSummary, { merge: true });

    const dailyProgressSnap = await getDoc(dailyRecordRef);
    const existingDailyQuestions = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.questionsAnswered : 0;
    const existingTopics = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.topics : [];

    const updatedTopics = Array.from(new Set([...existingTopics, ...topicsCovered]));

    const dataForDaily = {
      questionsAnswered: existingDailyQuestions + questionsAnsweredCorrectly,
      topics: updatedTopics,
      date: Timestamp.fromDate(today), // Guardar como Timestamp
    };
    const dailyPath = `/${collectionName}/${userId}/dailyProgress/${todayDateStr}`;
    console.log(`${actionName} Datos para escribir en el progreso diario ('${dailyPath}'):`, JSON.stringify(dataForDaily, null, 2));
    batch.set(dailyRecordRef, dataForDaily, { merge: true });

    await batch.commit();
    console.log(`${actionName} Batch commit exitoso.`);

    return { success: "¡Sesión de práctica registrada!" };
  } catch (error: any) {
    console.error(`${actionName} Error durante la operación:`, error);
    const path1 = `/${collectionName}/${userId}/streaks/summary`;
    const path2 = `/${collectionName}/${userId}/dailyProgress/...`;
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      return {
        error: `Error al registrar la sesión: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan escribir ('allow write: if request.auth.uid == userId;') en las subcolecciones: '${path1}' Y '${path2}'. Esto se configura dentro de 'match /${collectionName}/{userId} { match /streaks/summary { ... } match /dailyProgress/{dateId} { ... } }'. (Código: ${error.code})`
      };
    }
    return { error: `Error al registrar la sesión: ${error.message}` };
  }
}

export async function getStudyStreakData(userId: string): Promise<StreakData> {
  const collectionName = "users"; // Nombre de la colección principal de usuarios
  const actionName = "[getStudyStreakData Server Action]";
  const streakSummaryPath = `/${collectionName}/${userId}/streaks/summary`;
  console.log(`${actionName} Intentando obtener datos de racha para userId: ${userId} desde '${streakSummaryPath}'`);
  try {
    const streakSummaryRef = doc(db, collectionName, userId, "streaks", "summary");
    const summarySnap = await getDoc(streakSummaryRef);

    if (summarySnap.exists()) {
      const data = summarySnap.data();
      // Asegurarse de que completedDates es un array antes de mapear
      const completedDatesArray = Array.isArray(data.completedDates) ? data.completedDates : [];
      
      const completedDatesJS = completedDatesArray.map((ts: any) => {
        if (ts instanceof Timestamp) {
          const date = ts.toDate();
          date.setHours(0, 0, 0, 0); // Normalizar a la medianoche
          return date;
        } else if (ts && typeof ts.toDate === 'function') { // Cubre algunos objetos de fecha antiguos de Firebase
            const date = ts.toDate();
            date.setHours(0,0,0,0);
            return date;
        } else if (ts instanceof Date) { // Si ya es un objeto Date (aunque no debería ser si viene de Firestore)
            const date = new Date(ts.getTime()); // Clonar
            date.setHours(0,0,0,0);
            return date;
        } else if (typeof ts === 'string' || typeof ts === 'number') { // Intentar parsear si es string o número
            const date = new Date(ts);
            if (!isNaN(date.getTime())) {
                date.setHours(0,0,0,0);
                return date;
            }
        }
        console.warn(`${actionName} Elemento no válido encontrado en completedDates y será filtrado:`, ts);
        return null; // Devolver null para ser filtrado después
      }).filter(date => date instanceof Date) as Date[]; // Filtrar cualquier null

      const streakDataResult: StreakData = {
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        totalQuestionsAnswered: data.totalQuestionsAnswered || 0,
        completedDates: completedDatesJS,
      };
      console.log(`${actionName} Datos de racha encontrados para ${userId} en '${streakSummaryPath}':`, JSON.stringify({
        ...streakDataResult,
        completedDates: streakDataResult.completedDates.map(d => d.toISOString()) // Loguear ISO strings para legibilidad
      }));
      return streakDataResult;
    } else {
      console.log(`${actionName} No se encontró resumen de racha para ${userId} en '${streakSummaryPath}'. Devolviendo valores por defecto.`);
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalQuestionsAnswered: 0,
        completedDates: [],
      };
    }
  } catch (error: any) {
    console.error(`${actionName} Error al obtener datos de racha para ${userId} desde '${streakSummaryPath}':`, error);
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      console.error(`${actionName} PERMISO DENEGADO al leer '${streakSummaryPath}'. Revisa tus reglas de seguridad.`);
    }
    // Devolver valores por defecto en caso de cualquier error para no romper la UI
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalQuestionsAnswered: 0,
      completedDates: [],
    };
  }
}

// Esta función ya no se usa desde el cliente para cerrar sesión,
// pero se mantiene por si se necesita para un cierre de sesión iniciado por el servidor.
export async function signOutUser() {
  try {
    console.log("[signOutUser Server Action] Esta función está presente pero el cierre de sesión principal es del cliente.");
    return { success: "Sesión cerrada (función de servidor)." };
  } catch (error: any) {
    console.error("Error al cerrar sesión (actions.ts, signOutUser Server Action):", error);
    return { error: `Error al cerrar sesión: ${error.message}` };
  }
}

    