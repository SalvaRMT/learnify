
import { SignupForm } from "@/components/auth/SignupForm";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - Learnify',
  description: 'Create your Learnify account.',
};

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-accent/30 p-4">
      <SignupForm />
    </div>
  );
}
