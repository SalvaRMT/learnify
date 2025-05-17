
import { LoginForm } from "@/components/auth/LoginForm";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - Learnify',
  description: 'Login to your Learnify account.',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-accent/30 p-4">
      <LoginForm />
    </div>
  );
}
