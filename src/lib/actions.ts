
"use server";

import { auth, db } from "@/lib/firebaseConfig";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  sendEmailVerification,
  type UserCredential,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch, Timestamp } from "firebase/firestore";
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
  age: z.coerce.number().min(5, "Age must be at least 5.").max(120, "Age must be at most 120.").transform(val => val === '' ? undefined : val).optional(),
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

    // await sendEmailVerification(user); // Uncomment to enforce email verification

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      fullName,
      age,
      gender,
      createdAt: serverTimestamp(),
      authProvider: "email",
    });
    
    return { success: "Account created! You can now set your practice time or login.", userId: user.uid };
  } catch (error: any) {
    let clientErrorMessage = "Failed to create account. Please try again.";
    if (error.code === 'auth/email-already-in-use') {
      clientErrorMessage = "This email is already in use. Please try a different email or login.";
    } else if (error.code === 'unavailable') {
      clientErrorMessage = `${UNAVAILABLE_ERROR_MESSAGE} (Code: ${error.code})`;
    } else if (error.code === 'auth/operation-not-allowed') {
      clientErrorMessage = "Email/password sign-up is not enabled. Please enable it in your Firebase console (Authentication -> Sign-in method).";
    } else if (error.code === 'auth/configuration-not-found') {
      clientErrorMessage = `Firebase Authentication configuration not found for this project. Please ensure Authentication is enabled and configured in the Firebase console. (Code: ${error.code})`;
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
    const userDocSnap = await getDoc(userDocRef); // This line can trigger permission-denied

    // Email verification check (optional)
    // if (!userCredential.user.emailVerified && userDocSnap.exists() && userDocSnap.data()?.authProvider === 'email') {
    //   await firebaseSignOut(auth); 
    //   return { error: "Please verify your email before logging in." };
    // }
    return { success: "Logged in successfully!" };
  } catch (error: any) {
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        return { error: "Invalid email or password." };
    }
    if (error.code === 'unavailable') { // Firestore or Auth service unavailable
        return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Code: ${error.code})`};
    }
    if (error.code === 'auth/too-many-requests') {
        return { error: "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later."}
    }
    if (error.code === 'auth/configuration-not-found') {
      return { error: `Firebase Authentication configuration not found for this project. Please ensure Authentication is enabled and configured in the Firebase console. (Code: ${error.code})` };
    }
    if (error.code === 'permission-denied') { // Firestore specific
      return { error: "Login successful with Firebase Auth, but failed to retrieve user profile due to Firestore permissions. Please check your Firestore security rules to allow reads on the 'users/{userId}' path for authenticated users. (Code: permission-denied)" };
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
        // age, gender, practiceTime will be undefined initially for Google users.
      });
    } else {
      await updateDoc(userDocRef, {
        lastLoginAt: serverTimestamp(),
        fullName: displayName || userDocSnap.data()?.fullName || "Google User", 
        email: email,
      });
    }
    return { success: "User data ensured in Firestore." };
  } catch (error: any) {
    console.error("Firestore error for Google user:", error);
    if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Code: ${error.code})` };
    }
    if (error.code === 'permission-denied') {
      return { error: `Failed to save Google user data to Firestore due to permissions. Please check your Firestore security rules to allow creating/updating documents in 'users/{userId}' for authenticated users. (Code: ${error.code})` };
    }
    return { error: `Failed to save Google user data to Firestore: ${error.message}` };
  }
}


export async function signOutUser() {
  try {
    await firebaseSignOut(auth);
    return { success: "Signed out successfully!" };
  } catch (error: any) {
    console.error("Sign out error:", error);
    return { error: `Failed to sign out: ${error.message}` };
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
    if (error.code === 'permission-denied') {
      return { error: "Failed to save practice time due to Firestore permissions." };
    }
    return { error: `Failed to save practice time: ${error.message}` };
  }
}

export async function updateUserProfile(userId: string, values: Partial<z.infer<typeof ProfileUpdateSchema>>) {
  const validatedFields = ProfileUpdateSchema.partial().safeParse(values);
  if (!validatedFields.success) {
    return { error: "Invalid fields.", details: validatedFields.error.flatten().fieldErrors };
  }
  
  const dataToUpdate: { [key: string]: any } = {};
  for (const key in validatedFields.data) {
      const typedKey = key as keyof typeof validatedFields.data;
      if (validatedFields.data[typedKey] !== undefined) {
          dataToUpdate[typedKey] = validatedFields.data[typedKey];
      }
  }

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
     if (error.code === 'permission-denied') {
      return { error: "Failed to update profile due to Firestore permissions." };
    }
    return { error: `Failed to update profile: ${error.message}` };
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
    if (error.code === 'permission-denied') {
      return { error: "Failed to fetch profile due to Firestore permissions." };
    }
    return { error: `Failed to fetch profile: ${error.message}` };
  }
}

export async function getStudyStreakData(userId: string) {
  const userDocRef = doc(db, "users", userId, "streaks", "summary");
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Convert Firestore Timestamps to JS Dates for completedDates
      const completedDates = (data.completedDates || []).map((ts: any) => {
        if (ts instanceof Timestamp) {
          return ts.toDate();
        }
        return new Date(ts); // Fallback for other potential formats
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
    console.error("Error fetching streak data:", error);
    if (error.code === 'unavailable' || error.code === 'permission-denied') {
      console.error(`Firestore error (Code: ${error.code}): ${UNAVAILABLE_ERROR_MESSAGE}`);
    }
    return { currentStreak: 0, longestStreak: 0, totalQuestionsAnswered: 0, completedDates: [] };
  }
}

export async function getPracticeQuestions() {
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
    today.setHours(0,0,0,0); 

    const streakSummaryRef = doc(db, "users", userId, "streaks", "summary");
    const dailyRecordRef = doc(db, "users", userId, "dailyProgress", today.toISOString().split('T')[0]);

    const batch = writeBatch(db);

    const summarySnap = await getDoc(streakSummaryRef);
    let { 
      currentStreak = 0, 
      longestStreak = 0, 
      totalQuestionsAnswered = 0, 
      lastPracticeDate = null, // Firestore Timestamp or null
      completedDates = [] // Array of Firestore Timestamps or JS Dates
    } = summarySnap.exists() ? summarySnap.data() : {};
    
    let jsLastPracticeDate: Date | null = null;
    if (lastPracticeDate) {
      jsLastPracticeDate = (lastPracticeDate instanceof Timestamp) ? lastPracticeDate.toDate() : new Date(lastPracticeDate);
      jsLastPracticeDate.setHours(0,0,0,0);
    }

    if (jsLastPracticeDate) {
      const dayDifference = (today.getTime() - jsLastPracticeDate.getTime()) / (1000 * 3600 * 24);
      if (dayDifference === 1) {
        currentStreak += 1;
      } else if (dayDifference > 1) {
        currentStreak = 1; 
      }
    } else {
      currentStreak = 1;
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    totalQuestionsAnswered += questionsAnswered;
    
    const todayDateStr = today.toISOString().split('T')[0];
    const processedCompletedDates = completedDates.map((d: any) => 
      d instanceof Timestamp ? d.toDate() : new Date(d)
    );

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
    
    batch.set(dailyRecordRef, {
      questionsAnswered: existingDailyQuestions + questionsAnswered,
      topics: topicsCovered, 
      date: Timestamp.fromDate(today),
    }, { merge: true });

    await batch.commit();

    return { success: "Practice session recorded!" };
  } catch (error: any) {
    console.error("Error recording practice session:", error);
     if (error.code === 'unavailable') {
      return { error: `${UNAVAILABLE_ERROR_MESSAGE} (Code: ${error.code})` };
    }
    if (error.code === 'permission-denied') {
      return { error: `Failed to record session due to Firestore permissions. (Code: ${error.code})` };
    }
    return { error: `Failed to record session: ${error.message}` };
  }
}

    