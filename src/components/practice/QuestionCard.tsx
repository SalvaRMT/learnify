
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils';

export interface Question {
  id: string;
  topic: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

interface QuestionCardProps {
  question: Question;
  onAnswer: (isCorrect: boolean) => void;
}

export function QuestionCard({ question, onAnswer }: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!selectedAnswer) return;
    setSubmitted(true);
    onAnswer(selectedAnswer === question.correctAnswer);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-primary">{question.topic}</CardTitle>
        <CardDescription className="text-lg pt-2">{question.question}</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          onValueChange={setSelectedAnswer}
          disabled={submitted}
          className="space-y-3"
        >
          {question.options.map((option, index) => {
            const isCorrect = option === question.correctAnswer;
            const isSelected = option === selectedAnswer;
            return (
              <Label
                key={index}
                htmlFor={`${question.id}-option-${index}`}
                className={cn(
                  "flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all",
                  "hover:border-primary",
                  submitted && isCorrect && "bg-green-100 border-green-500 text-green-700",
                  submitted && isSelected && !isCorrect && "bg-red-100 border-red-500 text-red-700",
                  submitted && !isSelected && !isCorrect && "opacity-70",
                  isSelected && !submitted && "border-primary bg-primary/10"
                )}
              >
                <RadioGroupItem value={option} id={`${question.id}-option-${index}`} className="shrink-0" />
                <span>{option}</span>
              </Label>
            );
          })}
        </RadioGroup>
      </CardContent>
      <CardFooter className="flex justify-end">
        {!submitted ? (
          <Button onClick={handleSubmit} disabled={!selectedAnswer || submitted}>
            Submit Answer
          </Button>
        ) : (
          <p className={cn(
            "font-semibold",
            selectedAnswer === question.correctAnswer ? "text-green-600" : "text-red-600"
          )}>
            {selectedAnswer === question.correctAnswer ? "Correct!" : `Incorrect. The answer is ${question.correctAnswer}.`}
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
