
"use server";

import { auth, db } from "@/lib/firebaseConfig";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  sendEmailVerification,
  type UserCredential,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch, Timestamp, limit, collectionGroup } from "firebase/firestore";
import { z } from "zod";

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
  age: z.coerce.number().min(5, "La edad debe ser al menos 5.").max(120, "La edad debe ser como máximo 120.").optional().or(z.literal('')),
  gender: z.string().min(1, "Por favor selecciona un género.").optional(),
  email: z.string().email("Dirección de correo electrónico inválida."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

const LoginSchema = z.object({
  email: z.string().email("Dirección de correo electrónico inválida."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

const PracticeTimeSchema = z.object({
  practiceTime: z.coerce.number().min(5, "El tiempo de práctica debe ser de al menos 5 minutos."),
});

const ProfileUpdateSchema = z.object({
  fullName: z.string().min(2, "El nombre completo debe tener al menos 2 caracteres.").optional(),
  age: z.coerce.number().min(5, "La edad debe ser al menos 5.").max(120, "La edad debe ser como máximo 120.").transform(val => val === '' ? undefined : val).optional(),
  gender: z.string().min(1, "Por favor selecciona un género.").optional(),
  practiceTime: z.coerce.number().min(5, "El tiempo de práctica debe ser de al menos 5 minutos.").optional(),
});

const UNAVAILABLE_ERROR_MESSAGE = "Operación fallida. Por favor, verifica tu conexión a internet. Además, asegúrate de que Firestore esté habilitado e inicializado en la consola de tu proyecto de Firebase.";

export async function signUpUser(values: z.infer<typeof SignUpSchema>) {
  const validatedFields = SignUpSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Campos inválidos.", details: validatedFields.error.flatten().fieldErrors };
  }

  const { email, password, fullName, age, gender } = validatedFields.data;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      fullName,
      age: age === '' ? undefined : Number(age),
      gender: gender || undefined,
      createdAt: serverTimestamp(),
      authProvider: "email",
    });
    
    return { success: "¡Cuenta creada! Ahora puedes establecer tu tiempo de práctica o iniciar sesión.", userId: user.uid };
  } catch (error: any) {
    let clientErrorMessage = "Error al crear la cuenta. Por favor, inténtalo de nuevo.";
    if (error.code === 'auth/email-already-in-use') {
      clientErrorMessage = "Este correo electrónico ya está en uso. Por favor, prueba con un correo diferente o inicia sesión.";
    } else if (error.code === 'unavailable') {
      clientErrorMessage = `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})`;
    } else if (error.code === 'auth/operation-not-allowed') {
      clientErrorMessage = "El registro con correo electrónico/contraseña no está habilitado. Por favor, habilítalo en tu consola de Firebase (Autenticación -> Método de inicio de sesión).";
    } else if (error.code === 'auth/configuration-not-found') {
      clientErrorMessage = `No se encontró la configuración de Firebase Authentication para este proyecto. Asegúrate de que Authentication esté habilitado y configurado en la consola de Firebase. (Código: ${error.code})`;
    } else if (error.message) {
      clientErrorMessage = `Error al registrarse: ${error.message}`;
      if (error.code) {
        clientErrorMessage += ` (Código: ${error.code})`;
      }
    }
    return { error: clientErrorMessage };
  }
}

export async function signOutUser() {
  try {
    await firebaseSignOut(auth);
    return { success: "¡Sesión cerrada correctamente!" };
  } catch (error: any) {
    console.error("Error al cerrar sesión:", error);
    return { error: `Error al cerrar sesión: ${error.message}` };
  }
}

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
  for (const key in validatedFields.data) {
      const typedKey = key as keyof typeof validatedFields.data;
      if (validatedFields.data[typedKey] !== undefined) {
          dataToUpdate[typedKey] = validatedFields.data[typedKey];
      }
  }

  if (Object.keys(dataToUpdate).length === 0) {
    return { success: "No hay cambios para actualizar." };
  }

  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, dataToUpdate);
    return { success: "¡Perfil actualizado correctamente!" };
  } catch (error: any) {
    console.error("Error al actualizar el perfil:", error);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
     if (error.code === 'permission-denied') {
      return { error: "Error al actualizar el perfil debido a permisos de Firestore." };
    }
    return { error: `Error al actualizar el perfil: ${error.message}` };
  }
}

export async function getUserProfile(userId: string) {
  try {
    const userDocRef = doc(db, "users", userId);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    } else {
      return { error: "Perfil de usuario no encontrado." };
    }
  } catch (error: any) {
    console.error("Error al obtener el perfil:", error);
     if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied') {
      return { error: "Error al obtener el perfil debido a permisos de Firestore." };
    }
    return { error: `Error al obtener el perfil: ${error.message}` };
  }
}

export async function getStudyStreakData(userId: string) {
  const userDocRef = doc(db, "users", userId, "streaks", "summary");
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const completedDates = (data.completedDates || []).map((ts: any) => {
        if (ts instanceof Timestamp) {
          return ts.toDate();
        }
        return new Date(ts); 
      });
      return {
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        totalQuestionsAnswered: data.totalQuestionsAnswered || 0,
        completedDates: completedDates,
      };
    } else {
      return { currentStreak: 0, longestStreak: 0, totalQuestionsAnswered: 0, completedDates: [] };
    }
  } catch(error: any) {
    console.error("Error al obtener datos de racha:", error);
    if (error.code === 'unavailable' || error.code === 'permission-denied') {
      console.error(`Error de Firestore (Código: ${error.code}): ${UNAVAILABLE_ERROR_MESSAGE}`);
    }
    return { currentStreak: 0, longestStreak: 0, totalQuestionsAnswered: 0, completedDates: [] };
  }
}

export async function getPracticeQuestions(): Promise<Question[]> {
  try {
    const questionsColRef = collection(db, 'questions');
    const querySnapshot = await getDocs(questionsColRef);
    
    const allQuestions: Question[] = [];
    querySnapshot.forEach((docSnap) => {
      allQuestions.push({ id: docSnap.id, ...docSnap.data() } as Question);
    });

    if (allQuestions.length === 0) {
      console.log("No se encontraron preguntas en Firestore. Devolviendo un array vacío.");
      return [];
    }

    // Mezclar el array de preguntas
    const shuffledQuestions = allQuestions.sort(() => 0.5 - Math.random());
    
    // Seleccionar hasta 5 preguntas
    const selectedQuestions = shuffledQuestions.slice(0, 5);
    
    console.log(`Se seleccionaron ${selectedQuestions.length} preguntas de ${allQuestions.length} disponibles.`);
    return selectedQuestions;

  } catch (error: any) {
    console.error("Error al obtener las preguntas de práctica desde Firestore:", error);
    if (error.code === 'unavailable') {
      console.error(`Error de Firestore (Código: ${error.code}): ${UNAVAILABLE_ERROR_MESSAGE}`);
    } else if (error.code === 'permission-denied') {
      console.error("Error de permisos al leer la colección 'questions'. Asegúrate de que las reglas de seguridad de Firestore lo permitan.");
    }
    // Devolver preguntas de ejemplo en caso de error para que la app no se rompa completamente
    // Opcionalmente, podrías propagar el error o devolver un array vacío.
    // Por ahora, para mantener la funcionalidad básica de práctica:
    console.warn("Devolviendo preguntas de ejemplo debido a un error al obtenerlas de Firestore.");
    return [
      { id: 'q1_fallback', topic: 'Historia', question: '¿Quién fue el primer presidente de los Estados Unidos?', options: ['Abraham Lincoln', 'George Washington', 'Thomas Jefferson', 'John Adams'], correctAnswer: 'George Washington' },
      { id: 'q2_fallback', topic: 'Ciencia', question: '¿Cuál es el símbolo químico del agua?', options: ['H2O', 'O2', 'CO2', 'NaCl'], correctAnswer: 'H2O' },
      { id: 'q3_fallback', topic: 'Geografía', question: '¿Cuál es la capital de Francia?', options: ['Berlín', 'Madrid', 'París', 'Roma'], correctAnswer: 'París' },
      { id: 'q4_fallback', topic: 'Matemáticas', question: '¿Cuánto es 2 + 2?', options: ['3', '4', '5', '6'], correctAnswer: '4' },
      { id: 'q5_fallback', topic: 'Literatura', question: '¿Quién escribió "Hamlet"?', options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'], correctAnswer: 'William Shakespeare' },
    ];
  }
}

export async function recordPracticeSession(userId: string, questionsAnswered: number, topicsCovered: string[]) {
  if (!userId) {
    console.error("ID de usuario faltante para registrar la sesión de práctica.");
    return { error: "ID de usuario faltante." };
  }
  try {
    const today = new Date();
    today.setHours(0,0,0,0); 

    const streakSummaryRef = doc(db, "users", userId, "streaks", "summary");
    const dailyRecordRef = doc(db, "users", userId, "dailyProgress", today.toISOString().split('T')[0]);

    const batch = writeBatch(db);

    const summarySnap = await getDoc(streakSummaryRef);
    let { 
      currentStreak = 0, 
      longestStreak = 0, 
      totalQuestionsAnswered = 0, 
      lastPracticeDate = null, 
      completedDates = [] 
    } = summarySnap.exists() ? summarySnap.data() : {};
    
    let jsLastPracticeDate: Date | null = null;
    if (lastPracticeDate) {
      jsLastPracticeDate = (lastPracticeDate instanceof Timestamp) ? lastPracticeDate.toDate() : new Date(lastPracticeDate);
      jsLastPracticeDate.setHours(0,0,0,0);
    }

    let practiceDayAlreadyRecorded = false;
    const todayDateStr = today.toISOString().split('T')[0];
    const processedCompletedDates = (completedDates || []).map((d: any) => {
        const dateObj = (d instanceof Timestamp) ? d.toDate() : new Date(d);
        if (dateObj.toISOString().split('T')[0] === todayDateStr) {
            practiceDayAlreadyRecorded = true;
        }
        return dateObj;
    });


    if (!practiceDayAlreadyRecorded) {
        if (jsLastPracticeDate) {
            const dayDifference = (today.getTime() - jsLastPracticeDate.getTime()) / (1000 * 3600 * 24);
            if (dayDifference === 1) {
                currentStreak += 1;
            } else if (dayDifference > 1) {
                currentStreak = 1; 
            }
            // If dayDifference is 0, it means they practiced earlier today, currentStreak doesn't change yet
        } else {
            currentStreak = 1; // First time practicing
        }
    }
    // If practiceDayAlreadyRecorded is true, currentStreak remains as it was from previous save for today.


    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    totalQuestionsAnswered += questionsAnswered;
    
    if (!processedCompletedDates.some(d => d.toISOString().split('T')[0] === todayDateStr)) {
        processedCompletedDates.push(today); 
    }

    batch.set(streakSummaryRef, {
      currentStreak,
      longestStreak,
      totalQuestionsAnswered,
      lastPracticeDate: Timestamp.fromDate(today), 
      completedDates: processedCompletedDates.map(d => Timestamp.fromDate(d)) 
    }, { merge: true });

    const dailyProgressSnap = await getDoc(dailyRecordRef);
    const existingDailyQuestions = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.questionsAnswered : 0;
    const existingTopics = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.topics : [];
    const updatedTopics = Array.from(new Set([...existingTopics, ...topicsCovered]));
    
    batch.set(dailyRecordRef, {
      questionsAnswered: existingDailyQuestions + questionsAnswered,
      topics: updatedTopics, 
      date: Timestamp.fromDate(today),
    }, { merge: true });

    await batch.commit();

    return { success: "¡Sesión de práctica registrada!" };
  } catch (error: any) {
    console.error("Error al registrar la sesión de práctica:", error);
     if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Código: ${error.code})` };
    }
    if (error.code === 'permission-denied') {
      return { error: `Error al registrar la sesión debido a permisos de Firestore. (Código: ${error.code})` };
    }
    return { error: `Error al registrar la sesión: ${error.message}` };
  }
}

    

    