"use server";

import { auth, db } from "@/lib/firebaseConfig";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { z } from "zod";

const SignUpSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  age: z.coerce.number().min(5, "Age must be at least 5.").max(120, "Age must be at most 120."),
  gender: z.string().min(1, "Please select a gender."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const LoginSchema = z.object({
  email: z.string().email("Invalid email address."),
  password: z.string().min(1, "Password is required."),
});

const PracticeTimeSchema = z.object({
  practiceTime: z.coerce.number().min(5, "Practice time must be at least 5 minutes."),
});

const ProfileUpdateSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters.").optional(),
  age: z.coerce.number().min(5, "Age must be at least 5.").max(120, "Age must be at most 120.").optional(),
  gender: z.string().min(1, "Please select a gender.").optional(),
  practiceTime: z.coerce.number().min(5, "Practice time must be at least 5 minutes.").optional(),
});

const UNAVAILABLE_ERROR_MESSAGE = "Operation failed. Please check your internet connection. Also, ensure Firestore is enabled and has been initialized in your Firebase project console.";

export async function signUpUser(values: z.infer<typeof SignUpSchema>) {
  const validatedFields = SignUpSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Invalid fields.", details: validatedFields.error.flatten().fieldErrors };
  }

  const { email, password, fullName, age, gender } = validatedFields.data;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Send verification email
    // await sendEmailVerification(user); // Uncomment if you want to enforce email verification

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      fullName,
      age,
      gender,
      createdAt: serverTimestamp(),
      authProvider: "email",
      // practiceTime will be set in the next step if user proceeds
    });
    
    // For email sign up, we don't verify email immediately for login, but prompt later.
    // return { success: "Account created! Please check your email to verify your account.", userId: user.uid };
    return { success: "Account created! You can now set your practice time or login.", userId: user.uid };
  } catch (error: any) {
    let clientErrorMessage = "Failed to create account. Please try again.";
    if (error.code === 'auth/email-already-in-use') {
      clientErrorMessage = "This email is already in use. Please try a different email or login.";
    } else if (error.code === 'unavailable') {
      clientErrorMessage = `${UNAVAILABLE_ERROR_MESSAGE} (Code: ${error.code})`;
    } else if (error.message) {
      clientErrorMessage = `Sign up failed: ${error.message}`;
      if (error.code) {
        clientErrorMessage += ` (Code: ${error.code})`;
      }
    }
    return { error: clientErrorMessage };
  }
}

export async function loginUser(values: z.infer<typeof LoginSchema>) {
  const validatedFields = LoginSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Invalid fields." };
  }

  const { email, password } = validatedFields.data;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDocRef = doc(db, "users", userCredential.user.uid);
    const userDocSnap = await getDoc(userDocRef);

    // Email verification check - you can decide if this is strict
    // if (!userCredential.user.emailVerified && userDocSnap.exists() && userDocSnap.data()?.authProvider === 'email') {
    //   await firebaseSignOut(auth); 
    //   return { error: "Please verify your email before logging in. A new verification email can be sent if needed." };
    // }
    return { success: "Logged in successfully!" };
  } catch (error: any) {
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        return { error: "Invalid email or password." };
    }
    if (error.code === 'unavailable') { // Specific check for Firestore unavailability
        return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Code: ${error.code})`};
    }
    if (error.code === 'auth/too-many-requests') {
        return { error: "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later."}
    }
    let clientErrorMessage = "Failed to login. Please try again.";
    if (error.message) {
      clientErrorMessage = `Login failed: ${error.message}`;
      if (error.code) {
        clientErrorMessage += ` (Code: ${error.code})`;
      }
    }
    return { error: clientErrorMessage };
  }
}

export async function ensureGoogleUserInFirestore(userData: { uid: string; email: string | null; displayName: string | null; }) {
  const { uid, email, displayName } = userData;
  if (!uid || !email) {
    return { error: "User UID or Email is missing for Firestore operation."}
  }
  try {
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      await setDoc(userDocRef, {
        uid: uid,
        email: email,
        fullName: displayName || "Google User",
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        authProvider: "google",
        // age, gender, practiceTime will be undefined. User can set these in profile.
      });
    } else {
      // User exists, update last login time and potentially display name if it changed
      await updateDoc(userDocRef, {
        lastLoginAt: serverTimestamp(),
        fullName: displayName || userDocSnap.data()?.fullName || "Google User", 
        email: email, // In case email associated with Google account changed
      });
    }
    return { success: "User data ensured in Firestore." };
  } catch (error: any) {
    console.error("Firestore error for Google user:", error);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Code: ${error.code})` };
    }
    return { error: `Failed to save Google user data to Firestore: ${error.message}` };
  }
}


export async function signOutUser() {
  try {
    await firebaseSignOut(auth);
    return { success: "Signed out successfully!" };
  } catch (error) {
    console.error("Sign out error:", error);
    return { error: "Failed to sign out." };
  }
}

export async function savePracticeTime(userId: string, values: z.infer<typeof PracticeTimeSchema>) {
  const validatedFields = PracticeTimeSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Invalid practice time." };
  }

  const { practiceTime } = validatedFields.data;

  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, { practiceTime });
    return { success: "Practice time saved!" };
  } catch (error: any) {
    console.error("Error saving practice time:", error);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Code: ${error.code})` };
    }
    return { error: "Failed to save practice time." };
  }
}

export async function updateUserProfile(userId: string, values: Partial<z.infer<typeof ProfileUpdateSchema>>) {
  const validatedFields = ProfileUpdateSchema.partial().safeParse(values);
  if (!validatedFields.success) {
    return { error: "Invalid fields.", details: validatedFields.error.flatten().fieldErrors };
  }
  
  const dataToUpdate: { [key: string]: any } = {};
  // Filter out undefined values explicitly, but allow null if schema permits (it doesn't here for optionals)
  // Allow empty strings for string fields if they are meant to clear the field,
  // but Zod schema implies min length, so empty strings would fail validation anyway if not optional.
  // For numbers, coerce.number will turn '' to NaN, which is fine for Zod validation.
  // Firestore update will skip undefined fields.
  for (const key in values) {
    if (values[key as keyof typeof values] !== undefined) {
      dataToUpdate[key] = values[key as keyof typeof values];
    }
  }
   // Specifically handle clearing optional numeric fields if they are passed as empty string by form
   if (dataToUpdate.age === '') dataToUpdate.age = undefined;


  if (Object.keys(dataToUpdate).length === 0) {
    return { success: "No changes to update." };
  }

  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, dataToUpdate);
    return { success: "Profile updated successfully!" };
  } catch (error: any) {
    console.error("Error updating profile:", error);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Code: ${error.code})` };
    }
    return { error: "Failed to update profile." };
  }
}

export async function getUserProfile(userId: string) {
  try {
    const userDocRef = doc(db, "users", userId);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    } else {
      return { error: "User profile not found." };
    }
  } catch (error: any) {
    console.error("Error fetching profile:", error);
     if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Code: ${error.code})` };
    }
    return { error: "Failed to fetch profile." };
  }
}

export async function getStudyStreakData(userId: string) {
  const userDocRef = doc(db, "users", userId, "streaks", "summary");
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        totalQuestionsAnswered: data.totalQuestionsAnswered || 0,
        completedDates: (data.completedDates || []).map((ts: any) => ts.toDate ? ts.toDate() : new Date(ts)),
      };
    } else {
       // If no streak data, initialize with defaults
      return { currentStreak: 0, longestStreak: 0, totalQuestionsAnswered: 0, completedDates: [] };
    }
  } catch(error: any) {
    console.error("Error fetching streak data:", error);
    if (error.code === 'unavailable') {
      // Potentially return a specific error object or rethrow if critical
       // For now, returning default structure to prevent UI breakage, but with an error logged
      console.error(`${UNAVAILABLE_ERROR_MESSAGE} (Code: ${error.code})`);
    }
    // Fallback mock data if no real data or error to prevent UI breaking
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalQuestionsAnswered: 0,
      completedDates: [],
    };
  }
}

export async function getPracticeQuestions() {
  // This is a mock. In a real app, fetch from a DB or GenAI.
  await new Promise(resolve => setTimeout(resolve, 50)); 
  return [
    { id: 'q1', topic: 'History', question: 'Who was the first President of the United States?', options: ['Abraham Lincoln', 'George Washington', 'Thomas Jefferson', 'John Adams'], correctAnswer: 'George Washington' },
    { id: 'q2', topic: 'Science', question: 'What is the chemical symbol for water?', options: ['H2O', 'O2', 'CO2', 'NaCl'], correctAnswer: 'H2O' },
    { id: 'q3', topic: 'Geography', question: 'What is the capital of France?', options: ['Berlin', 'Madrid', 'Paris', 'Rome'], correctAnswer: 'Paris' },
    { id: 'q4', topic: 'Math', question: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correctAnswer: '4' },
    { id: 'q5', topic: 'Literature', question: 'Who wrote "Hamlet"?', options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'], correctAnswer: 'William Shakespeare' },
  ];
}

export async function recordPracticeSession(userId: string, questionsAnswered: number, topicsCovered: string[]) {
  if (!userId) {
    console.error("User ID is missing for recording practice session.");
    return { error: "User ID is missing." };
  }
  try {
    const today = new Date();
    today.setHours(0,0,0,0); // Normalize to start of day for consistent date comparison

    const streakSummaryRef = doc(db, "users", userId, "streaks", "summary");
    const dailyRecordRef = doc(db, "users", userId, "dailyProgress", today.toISOString().split('T')[0]);

    const batch = writeBatch(db);

    const summarySnap = await getDoc(streakSummaryRef);
    let { 
      currentStreak = 0, 
      longestStreak = 0, 
      totalQuestionsAnswered = 0, 
      lastPracticeDate = null, // Firestore Timestamp or null
      completedDates = [] // Array of Firestore Timestamps
    } = summarySnap.exists() ? summarySnap.data() : {};
    
    // Convert Firestore Timestamp to JS Date if necessary
    let jsLastPracticeDate: Date | null = null;
    if (lastPracticeDate && typeof lastPracticeDate.toDate === 'function') {
      jsLastPracticeDate = lastPracticeDate.toDate();
      jsLastPracticeDate.setHours(0,0,0,0); // Normalize for comparison
    }


    if (jsLastPracticeDate) {
      const dayDifference = (today.getTime() - jsLastPracticeDate.getTime()) / (1000 * 3600 * 24);
      if (dayDifference === 1) {
        currentStreak += 1;
      } else if (dayDifference > 1) {
        currentStreak = 1; // Reset streak
      }
      // If dayDifference is 0, it means practice already recorded today, streak doesn't increase further here.
    } else {
      // No previous practice, start streak at 1
      currentStreak = 1;
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    totalQuestionsAnswered += questionsAnswered;
    
    // Add today to completedDates if not already there
    const todayTimestamp = serverTimestamp(); // Use serverTimestamp for consistency if writing new
    const todayDateStr = today.toISOString().split('T')[0];

    // Convert existing completedDates (Timestamps) to string representations for comparison
    const completedDateStrings = completedDates.map((d: any) => {
      if (d.toDate) return d.toDate().toISOString().split('T')[0];
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return new Date(d).toISOString().split('T')[0]; // Fallback if it's already a string/number
    });

    let newCompletedDates = [...completedDates];
    if (!completedDateStrings.includes(todayDateStr)) {
        // If adding today, and it's a new record, use a Firestore Timestamp
        // For simplicity, if we are sure 'today' is the date, we can add it as a JS Date
        // which Firestore will convert to Timestamp on write.
        newCompletedDates.push(today); 
    }


    batch.set(streakSummaryRef, {
      currentStreak,
      longestStreak,
      totalQuestionsAnswered,
      lastPracticeDate: today, // Store as JS Date, Firestore converts to Timestamp
      completedDates: newCompletedDates 
    }, { merge: true });

    const dailyProgressSnap = await getDoc(dailyRecordRef);
    const existingDailyQuestions = dailyProgressSnap.exists() ? dailyProgressSnap.data()!.questionsAnswered : 0;
    
    batch.set(dailyRecordRef, {
      questionsAnswered: existingDailyQuestions + questionsAnswered,
      topics: topicsCovered, 
      date: today, // Store as JS Date
    }, { merge: true });

    await batch.commit();

    return { success: "Practice session recorded!" };
  } catch (error: any) {
    console.error("Error recording practice session:", error);
     if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Code: ${error.code})` };
    }
    return { error: `Failed to record session: ${error.message}` };
  }
}

