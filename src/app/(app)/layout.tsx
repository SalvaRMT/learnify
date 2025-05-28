
"use client";

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { BottomNavbar } from '@/components/layout/BottomNavbar';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // console.log(`%cAppLayout: Rendering. User: ${user ? user.uid : null}, Loading: ${loading}`, "color: green;");

  useEffect(() => {
    console.log(`%cAppLayout useEffect: User: ${user ? user.uid : null}, Loading: ${loading}`, "color: green; font-weight: bold;");
    if (!loading && !user) {
      console.log("%cAppLayout useEffect: Not loading and no user, redirecting to /login", "color: red; font-weight: bold;");
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    // console.log("%cAppLayout: In loading state, showing spinner.", "color: orange;");
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  if (!user) {
    // console.log("%cAppLayout: No user after loading, showing spinner (should be redirected by useEffect).", "color: orange;");
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
         <LoadingSpinner size={48} />
      </div>
    );
  }

  // console.log(`%cAppLayout: User ${user.uid} exists, rendering children.`, "color: green;");
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-grow pb-20 pt-4 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
      <BottomNavbar />
    </div>
  );
}

    