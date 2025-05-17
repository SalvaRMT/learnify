
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // console.log(`%cHomePage: Rendering. User: ${user ? user.uid : null}, Loading: ${loading}`, "color: purple;");

  useEffect(() => {
    console.log(`%cHomePage useEffect: User: ${user ? user.uid : null}, Loading: ${loading}`, "color: purple; font-weight: bold;");
    if (!loading) {
      if (user) {
        console.log("%cHomePage useEffect: User exists, redirecting to /dashboard", "color: green; font-weight: bold;");
        router.replace('/dashboard');
      } else {
        console.log("%cHomePage useEffect: No user, redirecting to /login", "color: red; font-weight: bold;");
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  // console.log("%cHomePage: Showing spinner (default).", "color: orange;");
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <LoadingSpinner size={48} />
    </div>
  );
}

    