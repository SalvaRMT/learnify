
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { getStudyStreakData } from "@/lib/actions";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, Award, HelpCircle } from "lucide-react";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalQuestionsAnswered: number;
}

const mockWeeklyProgress = [
  { day: "Mon", questions: Math.floor(Math.random() * 20) },
  { day: "Tue", questions: Math.floor(Math.random() * 20) },
  { day: "Wed", questions: Math.floor(Math.random() * 20) },
  { day: "Thu", questions: Math.floor(Math.random() * 20) },
  { day: "Fri", questions: Math.floor(Math.random() * 20) },
  { day: "Sat", questions: Math.floor(Math.random() * 20) },
  { day: "Sun", questions: Math.floor(Math.random() * 20) },
];

export function StreakStatsClient() {
  const { user } = useAuth();
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getStudyStreakData(user.uid)
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-muted-foreground">Could not load statistics data.</p>;
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-primary">Current Streak</CardTitle>
          <TrendingUp className="h-5 w-5 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{data.currentStreak} days</div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.currentStreak > 0 ? "Keep the fire burning!" : "Start a new streak today!"}
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-primary">Longest Streak</CardTitle>
          <Award className="h-5 w-5 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{data.longestStreak} days</div>
          <p className="text-xs text-muted-foreground mt-1">Your personal best!</p>
        </CardContent>
      </Card>

      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-primary">Total Questions Answered</CardTitle>
          <HelpCircle className="h-5 w-5 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{data.totalQuestionsAnswered}</div>
          <p className="text-xs text-muted-foreground mt-1">Knowledge is power!</p>
        </CardContent>
      </Card>
      
      <Card className="md:col-span-2 lg:col-span-3 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader>
          <CardTitle className="text-xl text-primary">Weekly Progress (Mock Data)</CardTitle>
          <CardDescription>Number of questions answered this week.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockWeeklyProgress}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  borderColor: 'hsl(var(--border))',
                  borderRadius: 'var(--radius)'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                itemStyle={{ color: 'hsl(var(--primary))' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="questions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
