
import type { Timestamp } from "firebase/firestore";

export interface UserProfile {
  uid?: string;
  email?: string | null;
  fullName?: string;
  age?: number | ''; // Allow empty string for form input
  gender?: string;
  practiceTime?: number;
  createdAt?: Timestamp | Date; // Can be Firestore Timestamp or JS Date
  lastLoginAt?: Timestamp | Date;
  authProvider?: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalQuestionsAnswered: number;
  completedDates: Date[]; // Store as JS Date objects on client
}

    