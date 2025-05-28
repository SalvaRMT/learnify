
"use client";

// useEffect and useState for local data fetching are removed
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
// getStudyStreakData is no longer called directly here
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, Award, HelpCircle } from "lucide-react";
// StreakData is now imported from @/types
// import type { StreakData } from "@/types";

// Mock data for chart remains, as actual weekly data isn't fetched yet
const mockWeeklyProgress = [
  { day: "Lun", questions: Math.floor(Math.random() * 20) },
  { day: "Mar", questions: Math.floor(Math.random() * 20) },
  { day: "Mié", questions: Math.floor(Math.random() * 20) },
  { day: "Jue", questions: Math.floor(Math.random() * 20) },
  { day: "Vie", questions: Math.floor(Math.random() * 20) },
  { day: "Sáb", questions: Math.floor(Math.random() * 20) },
  { day: "Dom", questions: Math.floor(Math.random() * 20) },
];

export function StreakStatsClient() {
  const { streakData, loading: authLoading } = useAuth(); // Use streakData and loading from AuthContext

  // useEffect for data fetching is removed.

  if (authLoading && !streakData) { // Show loading if auth is loading and streakData isn't available yet
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!streakData) {
    return <p className="text-center text-muted-foreground">No se pudieron cargar los datos de estadísticas.</p>;
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-primary">Racha Actual</CardTitle>
          <TrendingUp className="h-5 w-5 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{streakData.currentStreak} días</div>
          <p className="text-xs text-muted-foreground mt-1">
            {streakData.currentStreak > 0 ? "¡Sigue así!" : "¡Comienza una nueva racha hoy!"}
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-primary">Racha Más Larga</CardTitle>
          <Award className="h-5 w-5 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{streakData.longestStreak} días</div>
          <p className="text-xs text-muted-foreground mt-1">¡Tu mejor marca personal!</p>
        </CardContent>
      </Card>

      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-primary">Preguntas Respondidas</CardTitle>
          <HelpCircle className="h-5 w-5 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{streakData.totalQuestionsAnswered}</div>
          <p className="text-xs text-muted-foreground mt-1">¡El conocimiento es poder!</p>
        </CardContent>
      </Card>
      
      <Card className="md:col-span-2 lg:col-span-3 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader>
          <CardTitle className="text-xl text-primary">Progreso Semanal (Datos Ficticios)</CardTitle>
          <CardDescription>Número de preguntas respondidas esta semana.</CardDescription>
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

    