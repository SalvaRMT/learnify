
"use client";

import { useState, useEffect, useTransition } from 'react';
import { Question, QuestionCard } from './QuestionCard';
import { Button } from '@/components/ui/button';
import { getPracticeQuestions, recordPracticeSession } from '@/lib/actions';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function PracticeArea() {
  const { user, refreshUserAppData } = useAuth(); // Get refreshUserAppData from context
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isLoadingQuestions, startLoadingQuestionsTransition] = useTransition();
  const [isSubmittingSession, startSubmittingSessionTransition] = useTransition();

  const fetchQuestions = () => {
    startLoadingQuestionsTransition(async () => {
      setShowResults(false);
      setCurrentQuestionIndex(0);
      setScore(0);
      setAnsweredQuestions(0);
      const fetchedQuestions = await getPracticeQuestions();
      setQuestions(fetchedQuestions);
    });
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleAnswer = (isCorrect: boolean) => {
    if (isCorrect) {
      setScore(score + 1);
    }
    setAnsweredQuestions(answeredQuestions + 1);

    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        setShowResults(true);
        if (user) {
          startSubmittingSessionTransition(async () => {
            const topics = questions.map(q => q.topic);
            const uniqueTopics = [...new Set(topics)];
            const result = await recordPracticeSession(user.uid, score, uniqueTopics); // Pass score as questionsAnswered correctly for streak logic
            if (result.success) {
              toast({ title: "Sesión Registrada", description: "Tu práctica ha sido guardada." });
              await refreshUserAppData(); // Refresh context data
            } else {
              toast({ title: "Error al Registrar", description: result.error || "No se pudo guardar la sesión.", variant: "destructive"});
            }
          });
        }
      }
    }, 1500); 
  };

  const restartPractice = () => {
    fetchQuestions();
  };

  if (isLoadingQuestions) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando preguntas...</p>
      </div>
    );
  }

  if (showResults) {
    return (
      <Card className="w-full max-w-2xl mx-auto text-center shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary">¡Práctica Completa!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CardDescription className="text-xl">
            Obtuviste {score} de {questions.length} correctas.
          </CardDescription>
          <p className="text-muted-foreground">
            {score / questions.length >= 0.8 ? "¡Excelente trabajo! ¡Sigue así!" : 
             score / questions.length >= 0.5 ? "¡Buen esfuerzo! Sigue practicando." :
             "¡Sigue practicando para mejorar!"}
          </p>
          <Button onClick={restartPractice} size="lg" disabled={isSubmittingSession}>
            {isSubmittingSession && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Practicar de Nuevo <RefreshCcw className="ml-2 h-5 w-5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!questions.length || !questions[currentQuestionIndex]) {
    return (
      <div className="text-center py-10">
        <p className="text-xl text-muted-foreground mb-4">No hay preguntas disponibles en este momento. Por favor, intenta de nuevo más tarde.</p>
        <Button onClick={restartPractice} size="lg">
            Intentar de Nuevo <RefreshCcw className="ml-2 h-5 w-5" />
          </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center text-sm text-muted-foreground">
        Pregunta {currentQuestionIndex + 1} de {questions.length}
      </div>
      <QuestionCard
        key={questions[currentQuestionIndex].id}
        question={questions[currentQuestionIndex]}
        onAnswer={handleAnswer}
      />
    </div>
  );
}

    