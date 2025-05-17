
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isSubmitting, startSubmittingTransition] = useTransition();

  const fetchQuestions = () => {
    startLoadingTransition(async () => {
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

    // Automatically move to next question or show results
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        setShowResults(true);
        if (user) {
          startSubmittingTransition(async () => {
            const topics = questions.map(q => q.topic);
            const uniqueTopics = [...new Set(topics)];
            await recordPracticeSession(user.uid, questions.length, uniqueTopics);
            toast({ title: "Session Recorded", description: "Your practice has been logged." });
          });
        }
      }
    }, 1500); // Delay to see feedback
  };

  const restartPractice = () => {
    fetchQuestions();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading questions...</p>
      </div>
    );
  }

  if (showResults) {
    return (
      <Card className="w-full max-w-2xl mx-auto text-center shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary">Practice Complete!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CardDescription className="text-xl">
            You scored {score} out of {questions.length}.
          </CardDescription>
          <p className="text-muted-foreground">
            {score / questions.length >= 0.8 ? "Great job! Keep it up!" : 
             score / questions.length >= 0.5 ? "Good effort! Keep practicing." :
             "Keep practicing to improve!"}
          </p>
          <Button onClick={restartPractice} size="lg" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Practice Again <RefreshCcw className="ml-2 h-5 w-5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!questions.length || !questions[currentQuestionIndex]) {
    return (
      <div className="text-center py-10">
        <p className="text-xl text-muted-foreground mb-4">No questions available at the moment. Please try again later.</p>
        <Button onClick={restartPractice} size="lg">
            Try Again <RefreshCcw className="ml-2 h-5 w-5" />
          </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center text-sm text-muted-foreground">
        Question {currentQuestionIndex + 1} of {questions.length}
      </div>
      <QuestionCard
        key={questions[currentQuestionIndex].id}
        question={questions[currentQuestionIndex]}
        onAnswer={handleAnswer}
      />
    </div>
  );
}
