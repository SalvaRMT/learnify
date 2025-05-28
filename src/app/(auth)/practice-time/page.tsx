
import { PracticeTimeForm } from "@/components/auth/PracticeTimeForm";
import type { Metadata } from 'next';
import { Suspense } from "react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

export const metadata: Metadata = {
  title: 'Set Practice Time - Learnify',
  description: 'Set your daily learning goal on Learnify.',
};

// This page needs to be dynamic because it uses searchParams
export const dynamic = 'force-dynamic';


export default function PracticeTimePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-accent/30 p-4">
      <Suspense fallback={<LoadingSpinner size={48} />}>
        <PracticeTimeForm />
      </Suspense>
    </div>
  );
}
