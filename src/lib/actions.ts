
"use server";

import { auth, db } from "@/lib/firebaseConfig";
import { 
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, getDocs, writeBatch, Timestamp, limit } from "firebase/firestore";
import { z } from "zod";
import type { UserProfile, StreakData } from "@/types"; 

// Tipos para las preguntas, similar al que podrías tener en el frontend
export interface Question {
  id: string;
  topic: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

const SignUpSchema = z.object({
  fullName: z.string().min(2, "El nombre completo debe tener al menos 2 caracteres."),
  age: z.coerce.number().min(5, "La edad debe ser al menos 5.").max(120, "La edad debe ser como máximo 120.").optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  gender: z.string().min(1, "Por favor selecciona un género.").optional(),
  email: z.string().email("Dirección de correo electrónico inválida."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

const PracticeTimeSchema = z.object({
  practiceTime: z.coerce.number().min(5, "El tiempo de práctica debe ser de al menos 5 minutos."),
});

const ProfileUpdateSchema = z.object({
  fullName: z.string().min(2, "El nombre completo debe tener al menos 2 caracteres.").optional(),
  age: z.coerce.number().min(5, "La edad debe ser al menos 5.").max(120, "La edad debe ser como máximo 120.").optional().or(z.literal('')).transform(val => val === '' ? undefined : Number(val)),
  gender: z.string().min(1, "Por favor selecciona un género.").optional(),
  practiceTime: z.coerce.number().min(5, "El tiempo de práctica debe ser de al menos 5 minutos.").optional(),
});

const UNAVAILABLE_ERROR_MESSAGE = "Operación fallida. Por favor, verifica tu conexión a internet. Además, asegúrate de que Firestore esté habilitado e inicializado en la consola de tu proyecto de Firebase.";

export async function savePracticeTime(userId: string, values: z.infer<typeof PracticeTimeSchema>) {
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
    console.error("Error al guardar el tiempo de práctica:", error);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied') {
      return { error: "Error al guardar el tiempo de práctica debido a permisos de Firestore." };
    }
    return { error: `Error al guardar el tiempo de práctica: ${error.message}` };
  }
}

export async function updateUserProfile(userId: string, values: Partial<z.infer<typeof ProfileUpdateSchema>>) {
  const validatedFields = ProfileUpdateSchema.partial().safeParse(values);
  if (!validatedFields.success) {
    console.error("Error de validación al actualizar perfil:", validatedFields.error.flatten().fieldErrors);
    return { error: "Campos inválidos.", details: validatedFields.error.flatten().fieldErrors };
  }
  
  const dataToUpdate: { [key: string]: any } = {};
  const parsedData = validatedFields.data;

  if (parsedData.fullName !== undefined) dataToUpdate.fullName = parsedData.fullName;
  
  if (parsedData.age === null || parsedData.age === undefined) { 
    dataToUpdate.age = null; 
  } else if (typeof parsedData.age === 'number' && !isNaN(parsedData.age)) {
    dataToUpdate.age = parsedData.age;
  }

  if (parsedData.gender === null || parsedData.gender === undefined || parsedData.gender === "") {
     dataToUpdate.gender = null; 
  } else if (parsedData.gender) { 
     dataToUpdate.gender = parsedData.gender;
  }

  if (parsedData.practiceTime !== undefined) dataToUpdate.practiceTime = parsedData.practiceTime;

  if (Object.keys(dataToUpdate).length === 0) {
    return { success: "No hay cambios para actualizar." };
  }

  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, dataToUpdate);
    return { success: "¡Perfil actualizado correctamente!" };
  } catch (error: any)
 {
    console.error("Error al actualizar el perfil (actions.ts):", error);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied') {
      return { 
        error: "Error al actualizar el perfil: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan la actualización para el usuario autenticado. La regla común es 'allow update: if request.auth.uid == userId;' en la ruta 'match /users/{userId}'." 
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
  try {
    const userDocRef = doc(db, "users", userId);
    // CRUCIAL: Las reglas de seguridad de Firestore deben permitir 'read' en este documento
    // para el usuario autenticado (ej: allow read: if request.auth.uid == userId;).
    // Si esta operación falla con 'permission-denied', el perfil no se cargará.
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile; 
      const profileData: UserProfile = { ...data, uid: userId }; 

      if (data.createdAt && data.createdAt instanceof Timestamp) {
        profileData.createdAt = data.createdAt.toDate();
      }
      if (data.lastLoginAt && data.lastLoginAt instanceof Timestamp) {
        profileData.lastLoginAt = data.lastLoginAt.toDate();
      }
      
      profileData.age = data.age === undefined || data.age === null || data.age === '' ? '' : Number(data.age);
      
      return { success: true, data: profileData };
    } else {
      console.warn(`Perfil de usuario no encontrado en Firestore para UID: ${userId}`);
      return { success: false, error: "Perfil de usuario no encontrado." };
    }
  } catch (error: any) {
    console.error("Error al obtener el perfil:", error);
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
  console.log(`[getStudyStreakData] Fetching for userId: ${userId}`);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const completedDates = (data.completedDates || []).map((ts: any) => {
        if (ts instanceof Timestamp) {
          return ts.toDate();
        }
        if (typeof ts === 'string' || ts instanceof Date) {
            const dateObj = new Date(ts);
            if (!isNaN(dateObj.getTime())) return dateObj;
        }
        const parsedDate = new Date(ts);
        return isNaN(parsedDate.getTime()) ? new Date(0) : parsedDate; 
      }).filter((d: Date) => d.getTime() !== new Date(0).getTime()); 

      const streakSummary = {
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        totalQuestionsAnswered: data.totalQuestionsAnswered || 0,
        completedDates: completedDates,
      };
      console.log(`[getStudyStreakData] Data found for ${userId}:`, streakSummary);
      return streakSummary;
    } else {
      console.log(`[getStudyStreakData] No data found for ${userId}, returning defaults.`);
      return { currentStreak: 0, longestStreak: 0, totalQuestionsAnswered: 0, completedDates: [] };
    }
  } catch(error: any) {
    console.error("[getStudyStreakData] Error fetching streak data:", error);
    if (error.code === 'unavailable' || error.code === 'permission-denied') {
      console.error(`[getStudyStreakData] Firestore Error (Code: ${error.code}): ${UNAVAILABLE_ERROR_MESSAGE}`);
    }
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
  try {
    const questionsColRef = collection(db, 'questions');
    const querySnapshot = await getDocs(query(questionsColRef, limit(20))); 
    
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
    } else if (error.code === 'permission-denied') {
      console.error("[getPracticeQuestions] Permiso denegado al leer la colección 'questions'. Revisa las reglas de seguridad de Firestore.");
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
    // Solo se actualiza el total de preguntas si ya existe un resumen
    const streakSummaryRef = doc(db, "users", userId, "streaks", "summary");
    try {
        const summarySnap = await getDoc(streakSummaryRef);
        if (summarySnap.exists()) {
            const currentTotal = summarySnap.data().totalQuestionsAnswered || 0;
            // No hay cambio real en totalQuestionsAnswered si questionsAnsweredCorrectly es 0
            // await updateDoc(streakSummaryRef, { totalQuestionsAnswered: currentTotal }); 
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
      lastPracticeDate, // Firestore Timestamp or undefined
      completedDates = [] // Array of Firestore Timestamps or JS Dates if read before
    } = summarySnap.exists() ? summarySnap.data() : {};
    
    console.log("[recordPracticeSession] Resumen de racha inicial de Firestore:", { currentStreak, longestStreak, summaryTotalQuestions, lastPracticeDate: lastPracticeDate?.toDate?.().toISOString(), completedDates: completedDates.map((d: any) => d instanceof Timestamp ? d.toDate().toISOString() : new Date(d).toISOString()) });

    let completedDatesJS: Date[] = (completedDates || []).map((d: Timestamp | Date | string) => {
        let dateObj: Date;
        if (d instanceof Timestamp) dateObj = d.toDate();
        else if (d instanceof Date) dateObj = new Date(d.getTime()); 
        else dateObj = new Date(d); 

        if (isNaN(dateObj.getTime())) return new Date(0); 
        dateObj.setHours(0, 0, 0, 0);
        return dateObj;
    }).filter((d: Date) => d.getTime() !== new Date(0).getTime());

    console.log("[recordPracticeSession] completedDatesJS procesadas (normalizadas):", completedDatesJS.map(d => d.toISOString()));

    const practiceDayAlreadyRecorded = completedDatesJS.some(d => d.getTime() === today.getTime());
    console.log(`[recordPracticeSession] ¿Día de práctica ya registrado para hoy?: ${practiceDayAlreadyRecorded}`);

    if (!practiceDayAlreadyRecorded) {
        console.log("[recordPracticeSession] Hoy no se ha registrado práctica. Calculando nueva racha...");
        const lastPracticeDateJS = lastPracticeDate instanceof Timestamp ? lastPracticeDate.toDate() : (lastPracticeDate ? new Date(lastPracticeDate) : null);
        if (lastPracticeDateJS) {
            lastPracticeDateJS.setHours(0,0,0,0);
            console.log(`[recordPracticeSession] Última fecha de práctica (normalizada): ${lastPracticeDateJS.toISOString()}`);
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
             console.log(`[recordPracticeSession] Ayer (calculado desde 'today' normalizado): ${yesterday.toISOString()}`);

            if (lastPracticeDateJS.getTime() === yesterday.getTime()) {
                currentStreak += 1; 
                console.log("[recordPracticeSession] Racha continuada. Nueva racha actual:", currentStreak);
            } else { 
                currentStreak = 1; 
                console.log("[recordPracticeSession] Racha rota o primera práctica después de un espacio. Nueva racha actual:", currentStreak);
            }
        } else { 
            currentStreak = 1; 
            console.log("[recordPracticeSession] Primera práctica registrada. Nueva racha actual:", currentStreak);
        }
        
        if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
            console.log("[recordPracticeSession] Nueva racha más larga:", longestStreak);
        }
        
        completedDatesJS.push(today); 
        console.log("[recordPracticeSession] Hoy añadido a completedDatesJS. Nuevo array:", completedDatesJS.map(d => d.toISOString()));
    } else {
      console.log("[recordPracticeSession] Ya se practicó hoy. Racha no modificada. Solo se actualizará el total de preguntas y el progreso diario.");
    }
    
    summaryTotalQuestions += questionsAnsweredCorrectly; 
    console.log("[recordPracticeSession] Total de preguntas respondidas actualizado:", summaryTotalQuestions);

    const dataForSummary = {
      currentStreak,
      longestStreak,
      totalQuestionsAnswered: summaryTotalQuestions,
      lastPracticeDate: Timestamp.fromDate(today), 
      completedDates: completedDatesJS.map(d => Timestamp.fromDate(d)) 
    };
    console.log("[recordPracticeSession] Datos para escribir en el resumen de racha:", dataForSummary);
    batch.set(streakSummaryRef, dataForSummary, { merge: true });

    const dailyProgressSnap = await getDoc(dailyRecordRef);
    const existingDailyQuestions = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.questionsAnswered : 0;
    const existingTopics = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.topics : [];
    const updatedTopics = Array.from(new Set([...existingTopics, ...topicsCovered]));
    
    const dataForDaily = {
      questionsAnswered: existingDailyQuestions + questionsAnsweredCorrectly,
      topics: updatedTopics, 
      date: Timestamp.fromDate(today), 
    };
    console.log("[recordPracticeSession] Datos para escribir en el progreso diario:", dataForDaily);
    batch.set(dailyRecordRef, dataForDaily, { merge: true });

    await batch.commit();
    console.log("[recordPracticeSession] Batch commit exitoso.");

    return { success: "¡Sesión de práctica registrada!" };
  } catch (error: any) {
    console.error("[recordPracticeSession] Error durante la operación:", error);
     if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied') {
      return { error: `Error al registrar la sesión: PERMISOS DENEGADOS. Asegúrate de que tus reglas de seguridad de Firestore (en Firestore -> Reglas) permitan escribir en las subcolecciones '/users/{userId}/streaks/summary' Y '/users/{userId}/dailyProgress/{dateId}'. La regla común para subcolecciones es 'allow write: if request.auth.uid == userId;' dentro de 'match /users/{userId} { match /streaks/summary { ... } }'. (Código: ${error.code})` };
    }
    return { error: `Error al registrar la sesión: ${error.message}` };
  }
}

