
"use server";

import { auth, db } from "@/lib/firebaseConfig";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
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
      createdAt: new Date().toISOString(),
      authProvider: "email",
    });
    
    return { success: "Account created! Please check your email to verify your account.", userId: user.uid };
  } catch (error: any) {
    console.error("Sign up error object:", error);
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
    if (!userCredential.user.emailVerified) {
      const userEmail = userCredential.user.email;
      // Check if this user was created with Google provider. Google provider users might not have emailVerified set to true by Firebase in the same way.
      const userDocRef = doc(db, "users", userCredential.user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data()?.authProvider === 'google') {
        // If user signed up with Google, let them log in
         return { success: "Logged in successfully!" };
      }
      await firebaseSignOut(auth); 
      return { error: "Please verify your email before logging in." };
    }
    return { success: "Logged in successfully!" };
  } catch (error: any) {
    console.error("Login error object:", error);
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

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      // New user via Google
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        fullName: user.displayName || "Google User",
        // age, gender, practiceTime will be undefined initially for Google users
        // They can set it in their profile.
        createdAt: new Date().toISOString(),
        authProvider: "google",
      });
    } else {
      // Existing user, update last login or other relevant info if necessary
      await updateDoc(userDocRef, {
        lastLoginAt: new Date().toISOString(),
        // Optionally update fullName and email if they changed in Google profile
        fullName: user.displayName || userDocSnap.data()?.fullName || "Google User",
        email: user.email, 
      });
    }
    return { success: "Logged in with Google successfully!" };
  } catch (error: any) {
    console.error("Google Sign-In error object:", error);
    // Handle specific Google Sign-In errors
    if (error.code === 'auth/popup-closed-by-user') {
      return { error: "Sign-in popup closed. Please try again." };
    }
    if (error.code === 'auth/account-exists-with-different-credential') {
        return { error: "An account already exists with this email address using a different sign-in method. Try logging in with that method."};
    }
    let clientErrorMessage = "Failed to sign in with Google. Please try again.";
    if (error.message) {
      clientErrorMessage = `Google Sign-In failed: ${error.message}`;
      if (error.code) {
        clientErrorMessage += ` (Code: ${error.code})`;
      }
    }
    return { error: clientErrorMessage };
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

export async function updateUserProfile(userId: string, values: z.infer<typeof ProfileUpdateSchema>) {
  const validatedFields = ProfileUpdateSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Invalid fields.", details: validatedFields.error.flatten().fieldErrors };
  }
  
  const dataToUpdate = validatedFields.data;
  Object.keys(dataToUpdate).forEach(key => dataToUpdate[key as keyof typeof dataToUpdate] === undefined && delete dataToUpdate[key as keyof typeof dataToUpdate]);

  if (Object.keys(dataToUpdate).length === 0) {
    return { error: "No changes provided." };
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
  await new Promise(resolve => setTimeout(resolve, 500)); 
  return {
    currentStreak: Math.floor(Math.random() * 30),
    longestStreak: Math.floor(Math.random() * 100) + 30,
    totalQuestionsAnswered: Math.floor(Math.random() * 1000),
    completedDates: [new Date(), new Date(Date.now() - 86400000 * 2), new Date(Date.now() - 86400000 * 3)], 
  };
}

export async function getPracticeQuestions() {
  await new Promise(resolve => setTimeout(resolve, 500)); 
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
  await new Promise(resolve => setTimeout(resolve, 300));
  return { success: "Practice session recorded!" };
}

    