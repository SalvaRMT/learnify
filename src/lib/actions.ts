
"use server";

import { auth, db } from "@/lib/firebaseConfig";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  sendEmailVerification,
  // GoogleAuthProvider, // No longer used for server-side signInWithPopup
  // signInWithPopup // No longer used server-side for Google
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
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

export async function signUpUser(values: z.infer<typeof SignUpSchema>) {
  const validatedFields = SignUpSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Invalid fields.", details: validatedFields.error.flatten().fieldErrors };
  }

  const { email, password, fullName, age, gender } = validatedFields.data;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await sendEmailVerification(user);

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      fullName,
      age,
      gender,
      createdAt: serverTimestamp(),
      authProvider: "email",
    });
    
    return { success: "Account created! Please check your email to verify your account.", userId: user.uid };
  } catch (error: any) {
    let clientErrorMessage = "Failed to create account. Please try again.";
    if (error.message) {
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

    if (!userCredential.user.emailVerified && userDocSnap.exists() && userDocSnap.data()?.authProvider === 'email') {
      await firebaseSignOut(auth); 
      return { error: "Please verify your email before logging in." };
    }
    // For Google users or verified email users
    return { success: "Logged in successfully!" };
  } catch (error: any) {
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        return { error: "Invalid email or password." };
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
        authProvider: "google",
        // age, gender, practiceTime will be undefined initially. User can set these in profile.
      });
    } else {
      await updateDoc(userDocRef, {
        lastLoginAt: serverTimestamp(),
        fullName: displayName || userDocSnap.data()?.fullName || "Google User", // Update if display name changed
        email: email, // Update if email changed
      });
    }
    return { success: "User data ensured in Firestore." };
  } catch (error: any) {
    console.error("Firestore error for Google user:", error);
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
  } catch (error) {
    console.error("Error saving practice time:", error);
    return { error: "Failed to save practice time." };
  }
}

export async function updateUserProfile(userId: string, values: Partial<z.infer<typeof ProfileUpdateSchema>>) {
  // Note: Using Partial here as values might not contain all fields from ProfileUpdateSchema
  const validatedFields = ProfileUpdateSchema.partial().safeParse(values);
  if (!validatedFields.success) {
    return { error: "Invalid fields.", details: validatedFields.error.flatten().fieldErrors };
  }
  
  const dataToUpdate = { ...validatedFields.data }; // Clone to avoid mutating original
  Object.keys(dataToUpdate).forEach(keyStr => {
    const key = keyStr as keyof typeof dataToUpdate;
    if (dataToUpdate[key] === undefined || dataToUpdate[key] === '') {
      // For Firestore, to remove a field, you might need to use deleteField()
      // or simply not include it in the update if it's truly optional.
      // For now, we'll just remove undefined or empty strings from the update object.
      delete dataToUpdate[key];
    }
  });


  if (Object.keys(dataToUpdate).length === 0) {
    return { success: "No changes to update." }; // Or error: "No changes provided."
  }

  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, dataToUpdate);
    return { success: "Profile updated successfully!" };
  } catch (error) {
    console.error("Error updating profile:", error);
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
  } catch (error) {
    console.error("Error fetching profile:", error);
    return { error: "Failed to fetch profile." };
  }
}

// Mock actions for streaks and calendar data
export async function getStudyStreakData(userId: string) {
  // Simulate Firestore access for a specific user
  const userDocRef = doc(db, "users", userId, "streaks", "summary");
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        totalQuestionsAnswered: data.totalQuestionsAnswered || 0,
        // Ensure completedDates are an array of Date objects
        completedDates: (data.completedDates || []).map((ts: any) => ts.toDate ? ts.toDate() : new Date(ts)),
      };
    }
  } catch(e) { /* ignore, will return mock data */ }

  // Fallback mock data if no real data or error
  await new Promise(resolve => setTimeout(resolve, 100)); 
  return {
    currentStreak: Math.floor(Math.random() * 10),
    longestStreak: Math.floor(Math.random() * 20) + 5,
    totalQuestionsAnswered: Math.floor(Math.random() * 100),
    completedDates: [new Date(Date.now() - 86400000 * Math.floor(Math.random()*5) )], 
  };
}

export async function getPracticeQuestions() {
  await new Promise(resolve => setTimeout(resolve, 100)); 
  return [
    { id: 'q1', topic: 'History', question: 'Who was the first President of the United States?', options: ['Abraham Lincoln', 'George Washington', 'Thomas Jefferson', 'John Adams'], correctAnswer: 'George Washington' },
    { id: 'q2', topic: 'Science', question: 'What is the chemical symbol for water?', options: ['H2O', 'O2', 'CO2', 'NaCl'], correctAnswer: 'H2O' },
    { id: 'q3', topic: 'Geography', question: 'What is the capital of France?', options: ['Berlin', 'Madrid', 'Paris', 'Rome'], correctAnswer: 'Paris' },
    { id: 'q4', topic: 'Math', question: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correctAnswer: '4' },
    { id: 'q5', topic: 'Literature', question: 'Who wrote "Hamlet"?', options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'], correctAnswer: 'William Shakespeare' },
  ];
}

export async function recordPracticeSession(userId: string, questionsAnswered: number, topicsCovered: string[]) {
  console.log(`User ${userId} answered ${questionsAnswered} questions on topics: ${topicsCovered.join(', ')}`);
  // Example: Update user's streak and total questions in Firestore
  try {
    const today = new Date();
    today.setHours(0,0,0,0); // Normalize to start of day

    const userDocRef = doc(db, "users", userId);
    const streakSummaryRef = doc(db, "users", userId, "streaks", "summary");
    const dailyRecordRef = doc(db, "users", userId, "dailyProgress", today.toISOString().split('T')[0]);

    const summarySnap = await getDoc(streakSummaryRef);
    let { 
      currentStreak = 0, 
      longestStreak = 0, 
      totalQuestionsAnswered = 0, 
      lastPracticeDate = null,
      completedDates = [] 
    } = summarySnap.exists() ? summarySnap.data() : {};

    if (lastPracticeDate && typeof lastPracticeDate.toDate === 'function') {
      lastPracticeDate = lastPracticeDate.toDate();
    } else if (lastPracticeDate) {
      lastPracticeDate = new Date(lastPracticeDate);
    }


    const dayDifference = lastPracticeDate ? (today.getTime() - lastPracticeDate.getTime()) / (1000 * 3600 * 24) : Infinity;

    if (dayDifference === 1) {
      currentStreak += 1;
    } else if (dayDifference > 1 || !lastPracticeDate) {
      currentStreak = 1; // Reset or start new streak
    }
    // If dayDifference is 0, it means practice already recorded today, streak doesn't change.

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    totalQuestionsAnswered += questionsAnswered;
    
    const todayStr = today.toISOString();
    if (!completedDates.some((d:any) => (d.toDate ? d.toDate().toISOString() : new Date(d).toISOString()) === todayStr)) {
        completedDates.push(today);
    }


    await setDoc(streakSummaryRef, {
      currentStreak,
      longestStreak,
      totalQuestionsAnswered,
      lastPracticeDate: today,
      completedDates 
    }, { merge: true });

    await setDoc(dailyRecordRef, {
      questionsAnswered: (await getDoc(dailyRecordRef)).exists() ? 
        (await getDoc(dailyRecordRef)).data()!.questionsAnswered + questionsAnswered : questionsAnswered,
      topics: topicsCovered, // Could merge with existing topics for the day
      date: today,
    }, { merge: true });

    return { success: "Practice session recorded!" };
  } catch (error: any) {
    console.error("Error recording practice session:", error);
    return { error: `Failed to record session: ${error.message}` };
  }
}
