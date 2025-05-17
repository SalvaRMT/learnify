
"use server";

import { auth, db } from "@/lib/firebaseConfig";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  sendEmailVerification
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

    // Send email verification
    await sendEmailVerification(user);

    // Store additional user info in Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      fullName,
      age,
      gender,
      createdAt: new Date().toISOString(),
    });
    
    return { success: "Account created! Please check your email to verify your account.", userId: user.uid };
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      return { error: "This email is already in use." };
    }
    console.error("Sign up error:", error);
    return { error: "Failed to create account. Please try again." };
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
      await firebaseSignOut(auth); // Sign out user if email is not verified
      return { error: "Please verify your email before logging in." };
    }
    return { success: "Logged in successfully!" };
  } catch (error: any) {
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        return { error: "Invalid email or password." };
    }
    console.error("Login error:", error);
    return { error: "Failed to login. Please try again." };
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
  // Remove undefined fields
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
  // In a real app, fetch this from your database (e.g., MySQL)
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
  return {
    currentStreak: Math.floor(Math.random() * 30),
    longestStreak: Math.floor(Math.random() * 100) + 30,
    totalQuestionsAnswered: Math.floor(Math.random() * 1000),
    completedDates: [new Date(), new Date(Date.now() - 86400000 * 2), new Date(Date.now() - 86400000 * 3)], // Example dates
  };
}

export async function getPracticeQuestions() {
  // In a real app, fetch this from your MySQL database
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
  return [
    { id: 'q1', topic: 'History', question: 'Who was the first President of the United States?', options: ['Abraham Lincoln', 'George Washington', 'Thomas Jefferson', 'John Adams'], correctAnswer: 'George Washington' },
    { id: 'q2', topic: 'Science', question: 'What is the chemical symbol for water?', options: ['H2O', 'O2', 'CO2', 'NaCl'], correctAnswer: 'H2O' },
    { id: 'q3', topic: 'Geography', question: 'What is the capital of France?', options: ['Berlin', 'Madrid', 'Paris', 'Rome'], correctAnswer: 'Paris' },
    { id: 'q4', topic: 'Math', question: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correctAnswer: '4' },
    { id: 'q5', topic: 'Literature', question: 'Who wrote "Hamlet"?', options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'], correctAnswer: 'William Shakespeare' },
  ];
}

export async function recordPracticeSession(userId: string, questionsAnswered: number, topicsCovered: string[]) {
  // In a real app, this would update MySQL and potentially Firestore for streaks
  console.log(`User ${userId} answered ${questionsAnswered} questions on topics: ${topicsCovered.join(', ')}`);
  await new Promise(resolve => setTimeout(resolve, 300));
  return { success: "Practice session recorded!" };
}
