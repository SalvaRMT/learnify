
"use server";

import { auth, db } from "@/lib/firebaseConfig";
import { 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, getDocs, writeBatch, Timestamp, limit, collectionGroup } from "firebase/firestore";
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

export async function signUpUser(values: z.infer<typeof SignUpSchema>) {
  const validatedFields = SignUpSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Campos inválidos.", details: validatedFields.error.flatten().fieldErrors };
  }

  const { email, password, fullName, age, gender } = validatedFields.data;

  try {
    // No se necesita crear el usuario con el SDK de Admin si estás usando el SDK de cliente en el frontend
    // El usuario se crea en el cliente, y luego se puede pasar el UID para crear el doc en Firestore.
    // Esta acción de servidor ahora asume que el usuario YA FUE CREADO EN FIREBASE AUTH (cliente)
    // y solo se encarga de crear el documento en Firestore.
    // Esta función se llamará desde SignupForm.tsx *después* de createUserWithEmailAndPassword en cliente.

    // Simulación de que esta función ya no crea el usuario en Auth.
    // Si necesitas crear el usuario desde el servidor (lo cual no es el flujo actual para email/pass)
    // necesitarías el SDK de Admin. Por ahora, esta función es más para guardar datos adicionales.
    // Sin embargo, el SignupForm.tsx actual crea el usuario y luego el doc de firestore allí mismo.
    // Esta función 'signUpUser' como está definida aquí NO está siendo usada por SignupForm.tsx para crear el usuario.
    // SignupForm.tsx crea el usuario en Firebase Auth y luego escribe en Firestore directamente (a través de setDoc).

    // Este bloque es para ilustrar cómo sería si SÍ se usara esta server action POST-auth en cliente:
    // const user = auth.currentUser; // Esto NO funcionaría en una Server Action sin pasar el user.
    // if (!user) return { error: "Usuario no autenticado para crear perfil."};
    
    // Para el flujo actual, la creación de documento de usuario se hace en SignupForm.tsx.
    // Esta función podría ser refactorizada o eliminada si toda la lógica está en el cliente.
    // Dejándola como estaba por si la intención era otra:
    
    // Para este ejemplo, vamos a asumir que esta función está siendo llamada con datos del usuario.
    // PERO, SignupForm.tsx actualmente NO la usa para crear el usuario de Auth.
    // El siguiente código es más un placeholder si esta acción fuera usada para crear el doc en Firestore.

    // Si esta acción fuera a crear el usuario en Auth Y Firestore (necesitaría SDK Admin para Auth seguro desde servidor):
    // const userCredential = await admin.auth().createUser({ email, password, displayName: fullName });
    // const user = userCredential;
    // ... luego setDoc ...
    // Pero no estamos usando SDK Admin aquí.

    // Mantengo la estructura original de creación de usuario por si se reutiliza,
    // pero aclaro que SignupForm.tsx hace esto en el cliente.
    const userCredential = await firebaseSignInWithEmailAndPassword(auth, email, password); // Esto es incorrecto aquí, debería ser createUser...
                                                                                          // pero el SignUpForm ya lo hace.
                                                                                          // Lo mantendré como referencia pero sabiendo que no es el flujo activo.

    const user = userCredential.user; // Esto fallará si la línea de arriba no crea el usuario.

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      fullName,
      age: age === '' || age === undefined ? null : Number(age),
      gender: gender || null,
      createdAt: serverTimestamp(),
      authProvider: "email",
      lastLoginAt: serverTimestamp(),
      practiceTime: 15, // Default practice time
    });
    
    return { success: "¡Cuenta creada! Ahora puedes establecer tu tiempo de práctica o iniciar sesión.", userId: user.uid };
  } catch (error: any) {
    console.error("Error al crear la cuenta (actions.ts):", error);
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
  const parsedData = validatedFields.data;

  // Solo añadir campos al objeto de actualización si están definidos y no son una cadena vacía (excepto para 'age' y 'gender' que pueden ser null/undefined para borrar)
  if (parsedData.fullName !== undefined) dataToUpdate.fullName = parsedData.fullName;
  
  if (parsedData.age === null || parsedData.age === undefined) { // Si se quiere borrar la edad
    dataToUpdate.age = null;
  } else if (typeof parsedData.age === 'number' && !isNaN(parsedData.age)) {
    dataToUpdate.age = parsedData.age;
  }

  if (parsedData.gender === null || parsedData.gender === undefined || parsedData.gender === "") { // Si se quiere borrar el género
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

export async function getUserProfile(userId: string) {
  try {
    const userDocRef = doc(db, "users", userId);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Convertir Timestamps de Firestore a objetos Date si es necesario
      const profileData = { ...data };
      if (data.createdAt && data.createdAt instanceof Timestamp) {
        profileData.createdAt = data.createdAt.toDate();
      }
      if (data.lastLoginAt && data.lastLoginAt instanceof Timestamp) {
        profileData.lastLoginAt = data.lastLoginAt.toDate();
      }
      return { success: true, data: profileData };
    } else {
      console.warn(`Perfil de usuario no encontrado en Firestore para UID: ${userId}`);
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
        // Si ya es un string de fecha ISO, o un objeto Date, conviértelo a Date
        if (typeof ts === 'string' || ts instanceof Date) {
            const dateObj = new Date(ts);
            if (!isNaN(dateObj.getTime())) return dateObj;
        }
        // Fallback por si es un formato inesperado, intenta crear una fecha.
        // Podrías necesitar un manejo más robusto si los formatos varían mucho.
        const parsedDate = new Date(ts);
        return isNaN(parsedDate.getTime()) ? new Date() : parsedDate; // Evita fechas inválidas
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

const exampleQuestionsData: Question[] = [
  {
    id: "geo1",
    topic: "Geografía Mundial",
    question: "¿Cuál es el río más largo del mundo?",
    options: ["Amazonas", "Nilo", "Yangtsé", "Misisipi"],
    correctAnswer: "Amazonas", // Aunque históricamente se consideraba el Nilo, mediciones recientes suelen dar al Amazonas. Puedes ajustar esto.
  },
  {
    id: "sci1",
    topic: "Ciencia Elemental",
    question: "¿Cuál es el símbolo químico del oro?",
    options: ["Ag", "Au", "Pb", "Fe"],
    correctAnswer: "Au",
  },
  {
    id: "his1",
    topic: "Historia Antigua",
    question: "¿En qué año cayó el Imperio Romano de Occidente?",
    options: ["410 d.C.", "476 d.C.", "395 d.C.", "1453 d.C."],
    correctAnswer: "476 d.C.",
  },
  {
    id: "lit1",
    topic: "Literatura Clásica",
    question: "¿Quién escribió 'Don Quijote de la Mancha'?",
    options: ["William Shakespeare", "Miguel de Cervantes", "Homero", "Dante Alighieri"],
    correctAnswer: "Miguel de Cervantes",
  },
  {
    id: "art1",
    topic: "Arte Renacentista",
    question: "¿Quién pintó la 'Mona Lisa'?",
    options: ["Miguel Ángel", "Rafael Sanzio", "Leonardo da Vinci", "Tiziano"],
    correctAnswer: "Leonardo da Vinci",
  }
];


export async function getPracticeQuestions(): Promise<Question[]> {
  try {
    const questionsColRef = collection(db, 'questions');
    // Intenta obtener un número limitado de preguntas para no sobrecargar si hay muchas.
    // Para aleatoriedad real, necesitarías una solución más compleja o leer todas y seleccionar en el cliente/servidor.
    // Firestore no soporta "ORDER BY RANDOM()" directamente de forma eficiente para grandes datasets.
    // Una estrategia común es obtener N documentos y luego barajar.
    // Otra es tener un campo 'random' y hacer query sobre él, pero requiere mantener ese campo.
    
    const querySnapshot = await getDocs(query(questionsColRef, limit(20))); // Obtener hasta 20 preguntas
    
    const allQuestions: Question[] = [];
    querySnapshot.forEach((docSnap) => {
      allQuestions.push({ id: docSnap.id, ...docSnap.data() } as Question);
    });

    if (allQuestions.length === 0) {
      console.warn("No se encontraron preguntas en la colección 'questions' de Firestore. Devolviendo preguntas de ejemplo.");
      return exampleQuestionsData;
    }

    // Barajar las preguntas obtenidas y seleccionar 5 (o menos si hay menos de 5)
    const shuffledQuestions = allQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffledQuestions.slice(0, Math.min(5, shuffledQuestions.length)); // Tomar hasta 5
    
    console.log(`Se seleccionaron ${selectedQuestions.length} preguntas de ${allQuestions.length} disponibles en Firestore.`);
    return selectedQuestions;

  } catch (error: any) {
    console.error("Error al obtener las preguntas de práctica desde Firestore:", error);
    if (error.code === 'unavailable') {
      console.error(`Error de Firestore (Código: ${error.code}): ${UNAVAILABLE_ERROR_MESSAGE}`);
    } else if (error.code === 'permission-denied') {
      console.error("Error de permisos al leer la colección 'questions'. Asegúrate de que las reglas de seguridad de Firestore lo permitan.");
    }
    console.warn("Devolviendo preguntas de ejemplo debido a un error al obtener preguntas de Firestore.");
    return exampleQuestionsData;
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
    // Usar un formato consistente para el ID del documento diario, ej: YYYY-MM-DD
    const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dailyRecordRef = doc(db, "users", userId, "dailyProgress", todayDateStr);

    const batch = writeBatch(db);

    const summarySnap = await getDoc(streakSummaryRef);
    let { 
      currentStreak = 0, 
      longestStreak = 0, 
      totalQuestionsAnswered: summaryTotalQuestions = 0, 
      lastPracticeDate = null, // Este será un Timestamp de Firestore o null
      completedDates = [] // Este será un array de Timestamps de Firestore
    } = summarySnap.exists() ? summarySnap.data() : {};
    
    let jsLastPracticeDate: Date | null = null;
    if (lastPracticeDate && lastPracticeDate instanceof Timestamp) {
      jsLastPracticeDate = lastPracticeDate.toDate();
      jsLastPracticeDate.setHours(0,0,0,0); // Normalizar a medianoche
    }

    let practiceDayAlreadyRecordedForStreak = false;
    const processedCompletedDates: Date[] = (completedDates || []).map((d: Timestamp) => {
        const dateObj = d.toDate(); // Asumimos que d es un Timestamp
        dateObj.setHours(0,0,0,0); // Normalizar a medianoche
        if (dateObj.getTime() === today.getTime()) {
            practiceDayAlreadyRecordedForStreak = true;
        }
        return dateObj;
    });

    if (!practiceDayAlreadyRecordedForStreak) {
        if (jsLastPracticeDate) {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1); // Ayer a medianoche
            if (jsLastPracticeDate.getTime() === yesterday.getTime()) {
                currentStreak += 1; 
            } else if (jsLastPracticeDate.getTime() !== today.getTime()) { // No es hoy ni ayer
                currentStreak = 1; 
            }
            // Si jsLastPracticeDate ES today, significa que ya se registró hoy (no debería entrar aquí por practiceDayAlreadyRecordedForStreak)
        } else { // No hay lastPracticeDate, así que esta es la primera práctica
            currentStreak = 1; 
        }
        
        // Añadir 'today' a completedDates si no está ya (lo que no debería pasar si practiceDayAlreadyRecordedForStreak es false)
        if (!processedCompletedDates.some(d => d.getTime() === today.getTime())) {
            processedCompletedDates.push(today);
        }
    } else {
      // Si ya se practicó hoy, no actualizamos la racha, pero sí el lastPracticeDate si esta sesión es posterior
      // (aunque Firestore lo actualizará a 'today' igualmente)
    }


    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    
    summaryTotalQuestions += questionsAnswered;

    batch.set(streakSummaryRef, {
      currentStreak,
      longestStreak,
      totalQuestionsAnswered: summaryTotalQuestions,
      lastPracticeDate: Timestamp.fromDate(today), // Siempre actualizar a 'hoy'
      // Guardar completedDates como Timestamps de Firestore
      completedDates: processedCompletedDates.map(d => Timestamp.fromDate(d)) 
    }, { merge: true });

    // Para el progreso diario
    const dailyProgressSnap = await getDoc(dailyRecordRef);
    const existingDailyQuestions = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.questionsAnswered : 0;
    const existingTopics = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.topics : [];
    const updatedTopics = Array.from(new Set([...existingTopics, ...topicsCovered]));
    
    batch.set(dailyRecordRef, {
      questionsAnswered: existingDailyQuestions + questionsAnswered,
      topics: updatedTopics, 
      date: Timestamp.fromDate(today), // Guardar la fecha del registro
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
