
"use client";

import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { getStudyStreakData } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from 'date-fns';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalQuestionsAnswered: number;
  completedDates: Date[];
}

export function StudyCalendarClient() {
  const { user } = useAuth();
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (user) {
      getStudyStreakData(user.uid)
        .then((streakData) => {
          setData({
            ...streakData,
            // Ensure completedDates are Date objects
            completedDates: streakData.completedDates.map(d => new Date(d))
          });
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const completedOnSelectedDate = selectedDate && data?.completedDates.some(
    d => d.getFullYear() === selectedDate.getFullYear() &&
         d.getMonth() === selectedDate.getMonth() &&
         d.getDate() === selectedDate.getDate()
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-muted-foreground">Could not load calendar data.</p>;
  }
  
  return (
    <div className="grid md:grid-cols-3 gap-8">
      <Card className="md:col-span-2 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Your Study Calendar</CardTitle>
          <CardDescription>Track your daily learning progress.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border p-0"
            modifiers={{ completed: data.completedDates }}
            modifiersStyles={{
                completed: { 
                    color: 'hsl(var(--primary-foreground))',
                    backgroundColor: 'hsl(var(--primary))',
                    borderRadius: '0.25rem' // Adjust as needed
                }
            }}
            footer={
              selectedDate && (
                <p className="text-sm text-center pt-2">
                  {completedOnSelectedDate ? 
                    `You completed practice on ${format(selectedDate, 'PPP')}.` :
                    `No practice recorded for ${format(selectedDate, 'PPP')}.`
                  }
                </p>
              )
            }
          />
        </CardContent>
      </Card>
      <div className="space-y-6">
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl text-primary">Current Streak</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-4xl font-bold">{data.currentStreak} <span className="text-lg font-normal">days</span></p>
            </CardContent>
        </Card>
         <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl text-primary">Longest Streak</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-4xl font-bold">{data.longestStreak} <span className="text-lg font-normal">days</span></p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
