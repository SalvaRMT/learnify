
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


import { db, auth as serverAuth } from "@/lib/firebaseConfig"; // Import serverAuth for server-side admin tasks if needed.
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, getDocs, writeBatch, Timestamp, limit } from "firebase/firestore";
import { z } from "zod"; 
import type { UserProfile, StreakData } from "@/types";
import type { Question } from "@/components/practice/QuestionCard";
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth"; // client auth for actions

const UNAVAILABLE_ERROR_MESSAGE = "Operación fallida. Por favor, verifica tu conexión a internet. Además, asegúrate de que Firestore esté habilitado e inicializado en la consola de tu proyecto de Firebase.";

// ====================================================================================
// ¡¡¡ ATENCIÓN DESARROLLADOR: MENSAJE DE DIAGNÓSTICO CRÍTICO !!!
//
// ESTA FUNCIÓN INTENTA LEER EL PERFIL DE USUARIO DESDE FIRESTORE.
// SI ESTA OPERACIÓN FALLA CON UN ERROR DE "permission-denied", "permisos faltantes",
// O UN MENSAJE SIMILAR, ES CASI SEGURO QUE TUS REGLAS DE SEGURIDAD DE FIRESTORE
// (EN LA CONSOLA DE FIREBASE -> Firestore Database -> Rules) NO PERMITEN
// LA OPERACIÓN DE LECTURA ('read') EN EL DOCUMENTO '/users/{userId}'
// (o '/lusers/{userId}' si esa es tu colección) PARA EL USUARIO AUTENTICADO.
//
// LA REGLA DE SEGURIDAD NECESARIA EN FIRESTORE DEBE SER ALGO COMO:
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /users/{userId} { // ASEGÚRATE QUE EL NOMBRE DE LA COLECCIÓN ES 'users' (o 'lusers')
//       allow read: if request.auth.uid == userId; // ESTA ES LA LÍNEA CLAVE
//       // ... otras reglas como create, update, delete ...
//     }
//   }
// }
// ESTE PROBLEMA DEBE SOLUCIONARSE ACTUALIZANDO TUS REGLAS EN LA CONSOLA DE FIREBASE,
// NO PRIMARIAMENTE CAMBIANDO EL CÓDIGO DE ESTA FUNCIÓN.
//
// El AuthContext.tsx también tiene mensajes de diagnóstico en la consola del NAVEGADOR
// si esta función falla por permisos.
// ====================================================================================
export async function getUserProfile(userId: string): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  const userCollectionName = "users"; // Asegúrate que esto coincida con tu colección
  const actionName = "[getUserProfile Server Action]";
  console.log(`${actionName} Intentando obtener perfil para userId: ${userId} desde la ruta: /${userCollectionName}/${userId}`);

  if (!userId) {
    console.error(`${actionName} Error: userId es nulo o indefinido.`);
    return { success: false, error: "ID de usuario faltante." };
  }

  try {
    const userDocRef = doc(db, userCollectionName, userId);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const profile: UserProfile = {
        ...data,
        uid: userId,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined),
        lastLoginAt: data.lastLoginAt instanceof Timestamp ? data.lastLoginAt.toDate() : (data.lastLoginAt ? new Date(data.lastLoginAt) : undefined),
        age: data.age === undefined || data.age === null ? '' : Number(data.age),
        gender: data.gender === undefined || data.gender === null ? '' : String(data.gender),
      };
      console.log(`${actionName} Perfil encontrado para ${userId}.`);
      return { success: true, data: profile };
    } else {
      console.log(`${actionName} Documento de perfil NO encontrado para userId: ${userId} en /${userCollectionName}/${userId}`);
      return { success: false, error: "Perfil no encontrado." };
    }
  } catch (error: any) {
    console.error(`${actionName} Error al obtener perfil para ${userId} desde /${userCollectionName}/${userId}:`, error.message, error.code);
    if (error.code === 'unavailable') {
      return { success: false, error: `${UNAVAILABLE_ERROR_MESSAGE} (Code: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      // Este es el error que se muestra en el AuthContext si la lectura del perfil falla por permisos.
      return { success: false, error: `Error al obtener el perfil debido a permisos de Firestore.` };
    }
    return { success: false, error: error.message || "Error desconocido al obtener el perfil." };
  }
}


export async function savePracticeTime(userId: string, values: { practiceTime: number }) {
  const userCollectionName = "users"; // Asegúrate que esto coincida con tu colección
  const PracticeTimeSchema = z.object({
    practiceTime: z.coerce.number().min(5, "El tiempo de práctica debe ser de al menos 5 minutos por día."),
  });

  const validatedFields = PracticeTimeSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Tiempo de práctica inválido." };
  }

  const { practiceTime } = validatedFields.data;
  const userDocPath = `${userCollectionName}/${userId}`; 
  const actionName = "[savePracticeTime Server Action]";
  console.log(`${actionName} Intentando actualizar practiceTime para userId: ${userId} en la ruta: /${userDocPath} con valor: ${practiceTime}`);

  try {
    const userDocRef = doc(db, userCollectionName, userId); 
    await updateDoc(userDocRef, { practiceTime, lastUpdatedAt: serverTimestamp() });
    console.log(`${actionName} Tiempo de práctica guardado exitosamente para ${userId}.`);
    return { success: "¡Meta de práctica guardada!" };
  } catch (error: any) {
    console.error(`${actionName} Error al guardar el tiempo de práctica para ${userId} en /${userDocPath}:`, error.message, error.code);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      return {
        error: `Error al guardar el tiempo de práctica: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore permitan la operación 'update' en el documento '/${userCollectionName}/${userId}' para el usuario autenticado. La regla común es 'allow update: if request.auth.uid == userId;' dentro de 'match /${userCollectionName}/{userId} { ... }'. (Código: ${error.code})`
      };
    }
    return { error: `Error al guardar el tiempo de práctica: ${error.message}` };
  }
}

export async function updateUserProfile(userId: string, values: Partial<UserProfile>) {
  const userCollectionName = "users"; // Asegúrate que esto coincida con tu colección
  const actionName = "[updateUserProfile Server Action]";
  console.log(`${actionName} Iniciando actualización de perfil para userId: ${userId} con valores:`, values);
  
  const dataToUpdate: { [key: string]: any } = {};

  // Solo añadir campos al objeto de actualización si tienen un valor definido
  // y no son strings vacíos que deberían ser null o undefined.
  if (values.fullName !== undefined) {
    dataToUpdate.fullName = values.fullName === "" ? null : values.fullName;
  }
  if (values.age !== undefined) {
    dataToUpdate.age = values.age === '' || values.age === null ? null : Number(values.age);
  }
  if (values.gender !== undefined) {
    dataToUpdate.gender = values.gender === "" || values.gender === null ? null : values.gender;
  }
  if (values.practiceTime !== undefined) {
    dataToUpdate.practiceTime = Number(values.practiceTime);
  }


  if (Object.keys(dataToUpdate).length === 0) {
    console.log(`${actionName} No se detectaron cambios para actualizar para userId: ${userId}.`);
    return { success: "No hay cambios para actualizar." };
  }
  dataToUpdate.lastUpdatedAt = serverTimestamp();

  const userDocPath = `${userCollectionName}/${userId}`; 
  console.log(`${actionName} Intentando actualizar perfil para userId: ${userId} en la ruta: /${userDocPath} con datos:`, JSON.stringify(dataToUpdate));

  try {
    const userDocRef = doc(db, userCollectionName, userId);
    await updateDoc(userDocRef, dataToUpdate);
    console.log(`${actionName} Perfil actualizado exitosamente para ${userId}.`);
    return { success: "¡Perfil actualizado correctamente!" };
  } catch (error: any) {
    console.error(`${actionName} Error al actualizar el perfil para ${userId} en /${userDocPath}:`, error.message, error.code);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      return {
        error: `Error al actualizar el perfil: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan la operación 'update' en el documento '/${userCollectionName}/${userId}' para el usuario autenticado. La regla común es 'allow update: if request.auth.uid == userId;' dentro de 'match /${userCollectionName}/{userId} { ... }'. (Código: ${error.code})`
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
  const actionName = "[getPracticeQuestions Server Action]";
  console.log(`${actionName} Intentando obtener preguntas de Firestore de la colección '${collectionName}'...`);
  try {
    const questionsColRef = collection(db, collectionName);
    const q = query(questionsColRef, limit(50)); 
    const querySnapshot = await getDocs(q);

    const allQuestions: Question[] = [];
    querySnapshot.forEach((docSnap) => {
      allQuestions.push({ id: docSnap.id, ...docSnap.data() } as Question);
    });

    if (allQuestions.length === 0) {
      console.warn(`${actionName} No se encontraron preguntas en Firestore en '${collectionName}'. Devolviendo preguntas de ejemplo.`);
      return exampleQuestionsData; 
    }

    const shuffledQuestions = allQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffledQuestions.slice(0, Math.min(5, shuffledQuestions.length)); 

    console.log(`${actionName} Seleccionadas ${selectedQuestions.length} preguntas de ${allQuestions.length} disponibles en Firestore ('${collectionName}').`);
    return selectedQuestions;

  } catch (error: any) {
    console.error(`${actionName} Error al obtener preguntas de práctica de Firestore desde '${collectionName}':`, error.message, error.code);
    if (error.code === 'unavailable') {
      console.error(`${actionName} Error de Firestore (Código: ${error.code}): ${UNAVAILABLE_ERROR_MESSAGE}`);
    } else if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      console.error(`${actionName} PERMISO DENEGADO al leer la colección '${collectionName}'. Revisa tus reglas de seguridad de Firestore. La regla necesaria es 'allow read: if request.auth.uid != null;' en la ruta 'match /${collectionName}/{questionId} { ... }'.`);
    }
    console.warn(`${actionName} Devolviendo preguntas de ejemplo debido a un error al leer '${collectionName}'.`);
    return exampleQuestionsData; 
  }
}

export async function getStudyStreakData(userId: string): Promise<StreakData> {
  const userCollectionName = "users"; // Asegúrate que esto coincida con tu colección
  const actionName = "[getStudyStreakData Server Action]";
  const streakSummaryPath = `${userCollectionName}/${userId}/streaks/summary`;
  console.log(`${actionName} Intentando obtener datos de racha para userId: ${userId} desde '${streakSummaryPath}'`);
  try {
    const streakSummaryRef = doc(db, userCollectionName, userId, "streaks", "summary");
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

      console.log(`${actionName} Datos de racha encontrados para ${userId}. currentStreak: ${data.currentStreak}, longestStreak: ${data.longestStreak}, totalQuestionsAnswered: ${data.totalQuestionsAnswered}, completedDatesJS (primeras 5):`, completedDatesJS.slice(0,5).map(d => d.toISOString()));

      const streakDataResult: StreakData = {
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        totalQuestionsAnswered: data.totalQuestionsAnswered || 0,
        completedDates: completedDatesJS,
      };
      return streakDataResult;
    } else {
      console.log(`${actionName} No se encontró resumen de racha para ${userId} en ${streakSummaryPath}. Creando documento de resumen de racha por defecto.`);
      const defaultStreakData: StreakData = { currentStreak: 0, longestStreak: 0, totalQuestionsAnswered: 0, completedDates: [] };
      // Crear el documento de resumen de racha si no existe
      const defaultSummaryDoc = {
        currentStreak: 0,
        longestStreak: 0,
        totalQuestionsAnswered: 0,
        lastPracticeDate: null,
        completedDates: [],
        createdAt: serverTimestamp()
      };
      // Intenta crear el documento. Si esto falla por permisos, el error se manejará en el AuthContext.
      try {
          await setDoc(streakSummaryRef, defaultSummaryDoc);
          console.log(`${actionName} Documento de resumen de racha creado para ${userId} en ${streakSummaryPath}.`);
      } catch (creationError: any) {
          console.error(`${actionName} ERROR al intentar crear el documento de resumen de racha por defecto para ${userId} en ${streakSummaryPath}:`, creationError.message, creationError.code);
          // No relanzar el error aquí, simplemente se devolverán los datos por defecto.
          // El AuthContext manejará el error principal de lectura si los permisos fallan allí.
          if (creationError.code === 'permission-denied') {
            console.error(`${actionName} El error de creación del resumen de racha fue: PERMISOS DENEGADOS. Revisa tus reglas de seguridad para permitir la escritura en '${streakSummaryPath}'.`);
          }
      }
      return defaultStreakData;
    }
  } catch (error: any) {
    console.error(`${actionName} Error al obtener datos de racha para ${userId} desde '${streakSummaryPath}':`, error.message, error.code);
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      console.error(`${actionName} PERMISO DENEGADO al leer '${streakSummaryPath}'. Revisa tus reglas de seguridad de Firestore. Necesitas 'allow read: if request.auth.uid == userId;' en 'match /${userCollectionName}/${userId}/streaks/{docId} { ... }' (donde docId sería 'summary').`);
    }
    // En caso de error (incluyendo permisos), devolvemos datos por defecto para que la UI no se rompa.
    return { currentStreak: 0, longestStreak: 0, totalQuestionsAnswered: 0, completedDates: [] };
  }
}


export async function recordPracticeSession(userId: string, questionsAnsweredCorrectly: number, topicsCovered: string[]) {
  const userCollectionName = "users"; // Asegúrate que esto coincida con tu colección
  const actionName = "[recordPracticeSession Server Action]";

  // Mueve la declaración de todayNormalized y todayDateStr fuera del try para que estén disponibles en el catch
  const todayNormalized = new Date();
  todayNormalized.setHours(0, 0, 0, 0); // Normaliza a la medianoche
  const todayDateStr = `${todayNormalized.getFullYear()}-${String(todayNormalized.getMonth() + 1).padStart(2, '0')}-${String(todayNormalized.getDate()).padStart(2, '0')}`;

  console.log(`${actionName} INICIO para userId: ${userId}, preguntasCorrectas: ${questionsAnsweredCorrectly}, temas:`, topicsCovered);
  console.log(`${actionName} Fecha de hoy (normalizada para cálculos): ${todayNormalized.toISOString()}, String de fecha para dailyProgress: ${todayDateStr}`);

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
    const streakSummaryRef = doc(db, userCollectionName, userId, "streaks", "summary");
    const dailyRecordRef = doc(db, userCollectionName, userId, "dailyProgress", todayDateStr);
    
    console.log(`${actionName} Intentando LEER el resumen de racha desde: ${streakSummaryRef.path}`);
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
      console.log(`${actionName} No se encontró resumen de racha en ${streakSummaryPath}. Se asumirán valores por defecto (0) y se creará el documento si es necesario.`);
      currentStreak = 0;
      longestStreak = 0;
      summaryTotalQuestions = 0;
      lastPracticeDateFirestoreTimestamp = null;
      completedDatesFirestoreTimestamps = [];
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
      
      if (!newCompletedDatesJS.find(d => d.getTime() === todayNormalized.getTime())) {
        newCompletedDatesJS.push(new Date(todayNormalized.getTime())); 
        console.log(`${actionName} Hoy añadido a completedDates. Total días completados ahora: ${newCompletedDatesJS.length}, nueva fecha: ${todayNormalized.toISOString()}`);
      }
    } else {
      console.log(`${actionName} Ya se practicó hoy. Racha no modificada. Solo se actualizará el total de preguntas y el progreso diario.`);
    }

    const newSummaryTotalQuestions = summaryTotalQuestions + questionsAnsweredCorrectly;
    console.log(`${actionName} Total de preguntas respondidas actualizado: ${newSummaryTotalQuestions}`);

    // Asegurar que solo se guardan fechas únicas y se convierten a Timestamps
    const uniqueCompletedDatesTimestamps = Array.from(new Set(newCompletedDatesJS.map(d => d.getTime())))
                                          .map(time => Timestamp.fromDate(new Date(time))); 

    const dataForSummary = {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      totalQuestionsAnswered: newSummaryTotalQuestions,
      lastPracticeDate: Timestamp.fromDate(newLastPracticeDateJS),
      completedDates: uniqueCompletedDatesTimestamps, // Usar el array de Timestamps únicos
      updatedAt: serverTimestamp()
    };
    if (!summarySnap.exists()) {
      dataForSummary.createdAt = serverTimestamp();
    }
    console.log(`${actionName} DATOS PARA ESCRIBIR en resumen de racha ('${streakSummaryRef.path}'):`, JSON.stringify(dataForSummary, (key, value) => key === 'completedDates' && Array.isArray(value) ? `${value.length} Timestamps` : (value instanceof Timestamp ? value.toDate().toISOString() : value) , 2));
    

    console.log(`${actionName} Intentando LEER el progreso diario desde: ${dailyRecordRef.path}`);
    const dailyProgressSnap = await getDoc(dailyRecordRef);
    const existingDailyQuestions = dailyProgressSnap.exists() ? (dailyProgressSnap.data()!.questionsAnswered || 0) : 0;
    const existingTopics = dailyProgressSnap.exists() ? (dailyProgressSnap.data()!.topics || []) : [];
    const updatedTopics = Array.from(new Set([...existingTopics, ...topicsCovered]));

    const dataForDaily = {
      date: Timestamp.fromDate(todayNormalized), // Guardar la fecha normalizada
      questionsAnswered: existingDailyQuestions + questionsAnsweredCorrectly,
      topics: updatedTopics,
      updatedAt: serverTimestamp()
    };
     if (!dailyProgressSnap.exists()) {
      dataForDaily.createdAt = serverTimestamp();
    }
    console.log(`${actionName} DATOS PARA ESCRIBIR en progreso diario ('${dailyRecordPath}'):`, JSON.stringify(dataForDaily, null, 2));
    
    const batch = writeBatch(db);
    console.log(`${actionName} Añadiendo al batch: SET en '${streakSummaryRef.path}'`);
    batch.set(streakSummaryRef, dataForSummary, { merge: true }); 
    console.log(`${actionName} Añadiendo al batch: SET en '${dailyRecordRef.path}'`);
    batch.set(dailyRecordRef, dataForDaily, { merge: true }); 

    console.log(`${actionName} DATOS PREPARADOS PARA BATCH. Intentando hacer BATCH.COMMIT()...`);
    await batch.commit();
    console.log(`${actionName} FIN: Batch commit exitoso para UID: ${userId}.`);
    return { success: "¡Sesión de práctica registrada!" };

  } catch (error: any) {
    console.error(`${actionName} ERROR durante la operación para UID: ${userId}:`, error.message, error.code);
    
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      // Mensaje de error corregido para la guía
      const specificPathAttempt = `users/${userId}/streaks/summary O users/${userId}/dailyProgress/${todayDateStr}`;
      return {
        error: `Error al registrar la sesión: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan escribir (ej: 'allow write: if request.auth.uid == userId;') en las subcolecciones. Para el resumen de rachas, la ruta es '/users/${userId}/streaks/summary' y la regla debería ser similar a 'match /streaks/{docId} { allow write: if request.auth.uid == userId; }'. Para el progreso diario, la ruta es '/users/${userId}/dailyProgress/${todayDateStr}' (donde ${todayDateStr} es la fecha actual) y la regla 'match /dailyProgress/{dateId} { allow write: if request.auth.uid == userId; }'. Ambas anidadas bajo 'match /users/${userId}'. Si las reglas son correctas, verifica el contexto de autenticación de la Acción de Servidor. (Código: ${error.code})`
      };
    }
    return { error: `Error al registrar la sesión: ${error.message}` };
  }
}

// No se necesita signOutUser como acción de servidor si se maneja en el cliente.
// export async function signOutUser() {
//   try {
//     await firebaseSignOut(serverAuth); // O la instancia de auth que uses en servidor
//     return { success: "Cierre de sesión exitoso" };
//   } catch (error: any) {
//     console.error("Error al cerrar sesión (server action):", error);
//     return { error: `Error al cerrar sesión: ${error.message}` };
//   }
// }

    
