
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { updateUserProfile, signOutUser, getUserProfile } from "@/lib/actions";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const ProfileUpdateSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters.").optional(),
  age: z.coerce.number().min(5, "Age must be at least 5.").max(120, "Age must be at most 120.").optional(),
  gender: z.string().min(1, "Please select a gender.").optional(),
  practiceTime: z.coerce.number().min(5, "Practice time must be at least 5 minutes.").optional(),
});

const practiceTimeOptions = [
  { label: "5 minutes", value: 5 },
  { label: "10 minutes", value: 10 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "60 minutes", value: 60 },
];

export function ProfileForm() {
  const { user, userProfile, fetchUserProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isSigningOut, startSignOutTransition] = useTransition();
  const [isLoadingProfile, startLoadingProfileTransition] = useTransition();


  const form = useForm<z.infer<typeof ProfileUpdateSchema>>({
    resolver: zodResolver(ProfileUpdateSchema),
    defaultValues: {
      fullName: "",
      age: undefined,
      gender: "",
      practiceTime: 15,
    },
  });

  useEffect(() => {
    if (userProfile) {
      form.reset({
        fullName: userProfile.fullName || "",
        age: userProfile.age || undefined,
        gender: userProfile.gender || "",
        practiceTime: userProfile.practiceTime || 15,
      });
    } else if (user && !authLoading) { // Fetch if userProfile is null but user exists
        startLoadingProfileTransition(async () => {
            await fetchUserProfile(user.uid);
        });
    }
  }, [userProfile, user, authLoading, form, fetchUserProfile]);


  function onSubmit(values: z.infer<typeof ProfileUpdateSchema>) {
    if (!user) return;
    startUpdateTransition(async () => {
      const result = await updateUserProfile(user.uid, values);
      if (result.error) {
        toast({ title: "Update Failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Profile Updated", description: result.success });
        await fetchUserProfile(user.uid); // Re-fetch profile after update
      }
    });
  }

  const handleSignOut = () => {
    startSignOutTransition(async () => {
      const result = await signOutUser();
      if (result.error) {
        toast({ title: "Sign Out Failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Signed Out", description: result.success });
        router.push("/login");
        router.refresh(); // To ensure auth state is cleared everywhere
      }
    });
  };
  
  if (authLoading || isLoadingProfile) {
      return (
          <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
      );
  }

  if (!user) {
    return <p className="text-center text-muted-foreground">Please log in to view your profile.</p>;
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-primary">Your Profile</CardTitle>
        <CardDescription>
          Manage your account settings and preferences. Your email: {user.email} {user.emailVerified ? "(Verified)" : "(Not Verified)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="Your full name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl><Input type="number" placeholder="Your age" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || undefined)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="practiceTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Daily Practice Time Goal</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} value={String(field.value || 15)}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select daily practice time" /></SelectTrigger></FormControl>
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
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button type="submit" className="w-full sm:w-auto" disabled={isUpdating || authLoading || isLoadingProfile}>
                {(isUpdating || isLoadingProfile) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Button variant="outline" onClick={handleSignOut} className="w-full sm:w-auto" disabled={isSigningOut || authLoading}>
                {isSigningOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign Out
              </Button>
            </div>
             {!user.emailVerified && (
                <p className="text-sm text-yellow-600 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    Your email is not verified. Please check your inbox for a verification link. Some features might be limited.
                </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
