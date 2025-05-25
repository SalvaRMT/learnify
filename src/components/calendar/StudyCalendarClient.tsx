
"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function StudyCalendarClient() {
  const { streakData, loading: authLoading } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  console.log("[StudyCalendarClient] Render. AuthLoading:", authLoading, "StreakData:", streakData ? { ...streakData, completedDates: streakData.completedDates.map(d => d.toISOString()) } : null);

  const completedOnSelectedDate = selectedDate && streakData?.completedDates && streakData.completedDates.some(
    d => d.getFullYear() === selectedDate.getFullYear() &&
         d.getMonth() === selectedDate.getMonth() &&
         d.getDate() === selectedDate.getDate()
  );

  if (authLoading && !streakData) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!streakData) {
    return <p className="text-center text-muted-foreground">No se pudieron cargar los datos del calendario. Intenta refrescar o revisa tu conexión.</p>;
  }
  
  return (
    <div className="grid md:grid-cols-3 gap-8">
      <Card className="md:col-span-2 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Tu Calendario de Estudio</CardTitle>
          <CardDescription>Monitorea tu progreso de aprendizaje diario.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border p-0"
            modifiers={{ completed: streakData.completedDates || [] }} // Asegurar que completedDates es un array
            modifiersStyles={{
                completed: { 
                    color: 'hsl(var(--primary-foreground))',
                    backgroundColor: 'hsl(var(--primary))',
                    borderRadius: '0.25rem'
                }
            }}
            footer={
              selectedDate && (
                <p className="text-sm text-center pt-2">
                  {completedOnSelectedDate ? 
                    `Completaste la práctica el ${format(selectedDate, 'PPP', { locale: es })}.` :
                    `No hay práctica registrada para el ${format(selectedDate, 'PPP', { locale: es })}.`
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
                <CardTitle className="text-xl text-primary">Racha Actual</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-4xl font-bold">{streakData.currentStreak} <span className="text-lg font-normal">días</span></p>
            </CardContent>
        </Card>
         <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl text-primary">Racha Más Larga</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-4xl font-bold">{streakData.longestStreak} <span className="text-lg font-normal">días</span></p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
