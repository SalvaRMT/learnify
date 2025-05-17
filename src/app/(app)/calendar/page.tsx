
import { StudyCalendarClient } from "@/components/calendar/StudyCalendarClient";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Study Calendar - Learnify',
  description: 'Track your study streaks and progress on Learnify.',
};

export default function CalendarPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-primary">Study Progress</h1>
      <StudyCalendarClient />
    </div>
  );
}
