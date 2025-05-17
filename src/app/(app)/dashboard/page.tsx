
import { PracticeArea } from "@/components/practice/PracticeArea";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Practice - Learnify',
  description: 'Practice your general knowledge on Learnify.',
};

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-primary">Let's Practice!</h1>
      <PracticeArea />
    </div>
  );
}
