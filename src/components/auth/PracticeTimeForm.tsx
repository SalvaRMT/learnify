
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { savePracticeTime } from "@/lib/actions";
import { Loader2 } from "lucide-react";

const PracticeTimeSchema = z.object({
  practiceTime: z.coerce.number().min(5, "Practice time must be at least 5 minutes per day."),
});

const practiceTimeOptions = [
  { label: "5 minutes", value: 5 },
  { label: "10 minutes", value: 10 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "60 minutes", value: 60 },
];

export function PracticeTimeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!userId) {
      toast({
        title: "Error",
        description: "User ID is missing. Please sign up again.",
        variant: "destructive",
      });
      router.push("/signup");
    }
  }, [userId, router, toast]);

  const form = useForm<z.infer<typeof PracticeTimeSchema>>({
    resolver: zodResolver(PracticeTimeSchema),
    defaultValues: {
      practiceTime: 15,
    },
  });

  function onSubmit(values: z.infer<typeof PracticeTimeSchema>) {
    if (!userId) {
      toast({ title: "Error", description: "User ID not found.", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const result = await savePracticeTime(userId, values);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Practice Time Saved",
          description: "Your daily practice goal has been set!",
        });
        router.push("/login");
      }
    });
  }

  if (!userId) {
    // Or a loading state, but redirecting is probably better
    return <p className="text-center text-destructive">Invalid access. Redirecting...</p>;
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-primary">Set Your Daily Goal</CardTitle>
        <CardDescription className="text-center">
          How much time would you like to dedicate to learning each day?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="practiceTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Daily Practice Time</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={String(field.value)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select daily practice time" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {practiceTimeOptions.map(option => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
