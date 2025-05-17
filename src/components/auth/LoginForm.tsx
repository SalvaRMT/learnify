
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signInWithPopup, GoogleAuthProvider, type UserCredential } from "firebase/auth";
import { auth } from "@/lib/firebaseConfig";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { loginUser, ensureGoogleUserInFirestore } from "@/lib/actions";
import { Loader2 } from "lucide-react";

const LoginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l0.012-0.012l6.19,5.238C39.302,34.373,44,28.728,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);

export function LoginForm() {
  const router = useRouter(); // Still need router for other purposes if any, or remove if not used
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isGooglePending, startGoogleTransition] = useTransition();

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof LoginSchema>) {
    startTransition(async () => {
      console.log("LoginForm: Submitting email/password login");
      const result = await loginUser(values);
      if (result.error) {
        toast({
          title: "Login Failed",
          description: result.error,
          variant: "destructive",
        });
        console.error("LoginForm: Login failed", result.error);
      } else {
        console.log("LoginForm: Login successful. Auth state change will trigger navigation.");
        toast({
          title: "Login Successful",
          description: result.success + " Redirecting...",
        });
        // router.replace("/dashboard"); // REMOVED - Rely on AuthContext and HomePage/AppLayout
        // router.refresh(); // REMOVED
      }
    });
  }

  const handleGoogleSignIn = () => {
    startGoogleTransition(async () => {
      console.log("LoginForm: Attempting Google Sign-In (client-side popup)");
      const provider = new GoogleAuthProvider();
      try {
        const userCredential: UserCredential = await signInWithPopup(auth, provider);
        const user = userCredential.user;
        console.log("LoginForm: Google Sign-In with popup successful, user UID:", user.uid);

        const firestoreResult = await ensureGoogleUserInFirestore({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        });

        if (firestoreResult.error) {
          toast({
            title: "Google Sign-In Error",
            description: `Could not save user data: ${firestoreResult.error}`,
            variant: "destructive",
          });
          console.error("LoginForm: Google Sign-In Firestore error", firestoreResult.error);
        } else {
          console.log("LoginForm: Google Sign-In and Firestore update successful. Auth state change will trigger navigation.");
          toast({
            title: "Google Sign-In Successful",
            description: "Logged in with Google! Redirecting...",
          });
          // router.replace("/dashboard"); // REMOVED
          // router.refresh(); // REMOVED
        }
      } catch (error: any) {
        let errorMessage = "Google Sign-In failed. Please try again.";
        if (error.code === 'auth/popup-closed-by-user') {
          errorMessage = "Sign-in popup closed. Please try again.";
        } else if (error.code === 'auth/account-exists-with-different-credential') {
          errorMessage = "An account already exists with this email using a different sign-in method.";
        } else if (error.code === 'auth/operation-not-supported-in-this-environment' || error.code === 'auth/unauthorized-domain') {
            errorMessage = `Google Sign-In error: This domain is not authorized for OAuth operations. Please add your domain (e.g., localhost) to the 'Authorized domains' list in your Firebase console (Authentication -> Settings) and ensure it's also in your Google Cloud OAuth client's 'Authorized JavaScript origins'. (Code: ${error.code})`;
        } else if (error.code === 'auth/configuration-not-found') {
          errorMessage = `Firebase Authentication configuration not found for this project. Please ensure Authentication and Google Sign-in are enabled and configured in the Firebase console. (Code: ${error.code})`;
        } else if (error.message) {
          errorMessage = `Google Sign-In error: ${error.message} (Code: ${error.code})`;
        }
        toast({
          title: "Google Sign-In Failed",
          description: errorMessage,
          variant: "destructive",
        });
        console.error("LoginForm: Google Sign-In failed", error);
      }
    });
  };

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-primary">Welcome Back!</CardTitle>
        <CardDescription className="text-center">
          Login to continue your learning journey.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isPending || isGooglePending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </form>
        </Form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isPending || isGooglePending}>
          {isGooglePending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Sign in with Google
        </Button>

        <p className="mt-6 text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
