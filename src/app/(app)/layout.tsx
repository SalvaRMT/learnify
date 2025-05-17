
"use client";

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { BottomNavbar } from '@/components/layout/BottomNavbar';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  if (!user) {
    // This state should ideally not be reached if useEffect redirects,
    // but as a fallback:
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
         <LoadingSpinner size={48} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-grow pb-20 pt-4 px-4 sm:px-6 lg:px-8"> 
        {/* pb-20 for bottom navbar clearance */}
        {children}
      </main>
      <BottomNavbar />
    </div>
  );
}
