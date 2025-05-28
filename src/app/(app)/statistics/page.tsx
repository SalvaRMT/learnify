
import { StreakStatsClient } from "@/components/statistics/StreakStatsClient";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Statistics - Learnify',
  description: 'View your learning statistics and progress on Learnify.',
};

export default function StatisticsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-primary">Your Learning Stats</h1>
      <StreakStatsClient />
    </div>
  );
}
