
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useTransition, useState } from "react";

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
import { updateUserProfile, signOutUser } from "@/lib/actions";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const ProfileUpdateSchema = z.object({
  fullName: z.string().min(2, "El nombre completo debe tener al menos 2 caracteres.").optional(),
  age: z.coerce.number().min(5, "La edad debe ser al menos 5.").max(120, "La edad debe ser como máximo 120.").optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  gender: z.string().min(1, "Por favor selecciona un género.").optional(),
  practiceTime: z.coerce.number().min(5, "El tiempo de práctica debe ser de al menos 5 minutos.").optional(),
});

const practiceTimeOptions = [
  { label: "5 minutos", value: 5 },
  { label: "10 minutos", value: 10 },
  { label: "15 minutos", value: 15 },
  { label: "30 minutos", value: 30 },
  { label: "60 minutos", value: 60 },
];

export function ProfileForm() {
  const { user, userProfile, fetchUserAppData, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isSigningOut, startSignOutTransition] = useTransition();
  const [isLoadingProfile, setIsLoadingProfile] = useState(true); // Local loading state for profile data

  const form = useForm<z.infer<typeof ProfileUpdateSchema>>({
    resolver: zodResolver(ProfileUpdateSchema),
    defaultValues: {
      fullName: "",
      age: '',
      gender: "",
      practiceTime: 15,
    },
  });

  // Effect to reset form when userProfile data is available or changes
  useEffect(() => {
    console.log("ProfileForm useEffect [userProfile, authLoading]: authLoading:", authLoading, "userProfile exists:", !!userProfile);
    if (!authLoading && userProfile) {
      form.reset({
        fullName: userProfile.fullName || "",
        age: userProfile.age === undefined || userProfile.age === null ? '' : Number(userProfile.age),
        gender: userProfile.gender || "",
        practiceTime: userProfile.practiceTime || 15,
      });
      setIsLoadingProfile(false); // Profile is loaded
      console.log("ProfileForm: Profile data loaded into form:", userProfile);
    } else if (!authLoading && user && !userProfile) {
      // User is loaded, auth is done, but no profile yet. Keep showing loading.
      setIsLoadingProfile(true);
      console.log("ProfileForm: User loaded, no profile yet. Kept isLoadingProfile true.");
    } else if (authLoading && user) {
      // Auth is loading, user might be available from a previous session, wait for auth to finish
      setIsLoadingProfile(true);
      console.log("ProfileForm: Auth is loading, waiting for profile...");
    } else if (!authLoading && !user) {
      // No user, auth is done, so no profile to load
      setIsLoadingProfile(false);
      console.log("ProfileForm: No user and auth not loading. No profile to load.");
    }
  }, [userProfile, authLoading, form, user]);


  // Effect to fetch user profile if it's missing after initial auth check
  useEffect(() => {
    console.log("ProfileForm useEffect [user, authLoading, userProfile, fetchUserAppData]: user:",!!user, "authLoading:", authLoading, "userProfile exists:", !!userProfile)
    if (user && !authLoading && !userProfile && !isLoadingProfile) { // only fetch if not already loading profile locally
      console.log("ProfileForm: User exists, auth not loading, profile missing. Attempting to fetch profile.");
      setIsLoadingProfile(true);
      fetchUserAppData(user.uid).finally(() => {
        // AuthContext will update userProfile, triggering the other useEffect to reset the form.
        // We only set local loading to false here if the fetch is done.
        // The actual population of the form happens when userProfile changes.
        setIsLoadingProfile(false); 
        console.log("ProfileForm: fetchUserAppData attempt finished in useEffect. Local isLoadingProfile set to false.");
      });
    }
  }, [user, authLoading, userProfile, fetchUserAppData, isLoadingProfile]);


  function onSubmit(values: z.infer<typeof ProfileUpdateSchema>) {
    if (!user) return;
    
    const finalValues: { [key: string]: any } = {};
    // Only include fields that have actually changed from the current profile
    // or are being set for the first time.
    if (values.fullName !== undefined && values.fullName !== (userProfile?.fullName || "")) {
      finalValues.fullName = values.fullName;
    }
    
    const ageFromForm = values.age === '' || values.age === undefined ? null : Number(values.age);
    const ageFromProfile = userProfile?.age === '' || userProfile?.age === undefined || userProfile?.age === null ? null : Number(userProfile.age);

    if (ageFromForm !== ageFromProfile) {
       finalValues.age = ageFromForm; 
    }

    const genderFromForm = values.gender === "" || values.gender === undefined ? null : values.gender;
    const genderFromProfile = userProfile?.gender === "" || userProfile?.gender === undefined || userProfile?.gender === null ? null : userProfile.gender;

    if (genderFromForm !== genderFromProfile) {
      finalValues.gender = genderFromForm;
    }

    if (values.practiceTime !== undefined && values.practiceTime !== (userProfile?.practiceTime || 15)) {
      finalValues.practiceTime = values.practiceTime;
    }

    if (Object.keys(finalValues).length === 0) {
      toast({ title: "Sin Cambios", description: "No se detectaron cambios para actualizar." });
      return;
    }

    startUpdateTransition(async () => {
      console.log("ProfileForm onSubmit: Updating profile with values:", finalValues);
      const result = await updateUserProfile(user.uid, finalValues);
      if (result.error) {
        toast({ 
            title: "Fallo al Actualizar", 
            description: result.error, // This will now show the more specific error from actions.ts
            variant: "destructive",
            duration: 9000, 
        });
      } else {
        toast({ title: "Perfil Actualizado", description: result.success });
        if(user.uid) { // Ensure user.uid is still valid
            await fetchUserAppData(user.uid); // Refresh profile data in context
        }
      }
    });
  }

  const handleSignOut = () => {
    startSignOutTransition(async () => {
      const result = await signOutUser();
      if (result.error) {
        toast({ title: "Fallo al Cerrar Sesión", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Sesión Cerrada", description: "Has cerrado sesión correctamente." });
        router.push("/login"); // Redirect to login after sign out
      }
    });
  };
  
  // Main loading state: either AuthContext is loading, or we are locally loading profile
  if (authLoading || (isLoadingProfile && user && !userProfile)) {
      return (
          <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-3">Cargando perfil...</p>
          </div>
      );
  }

  if (!user) {
    // This case should ideally be handled by AppLayout redirecting to /login
    // But as a fallback:
    return <p className="text-center text-muted-foreground">Por favor, inicia sesión para ver tu perfil.</p>;
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-primary">Tu Perfil</CardTitle>
        <CardDescription>
          Gestiona la configuración y preferencias de tu cuenta. Tu correo: {user.email} {user.emailVerified ? "(Verificado)" : "(No Verificado)"}
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
                  <FormLabel>Nombre Completo</FormLabel>
                  <FormControl><Input placeholder="Tu nombre completo" {...field} value={field.value || ""} /></FormControl>
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
                    <FormLabel>Edad</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Tu edad" 
                        {...field} 
                        onChange={e => field.onChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                        value={field.value === undefined || field.value === null ? '' : field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Género</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona tu género" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="male">Masculino</SelectItem>
                        <SelectItem value="female">Femenino</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefiero no decirlo</SelectItem>
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
                  <FormLabel>Meta de Tiempo de Práctica Diario</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} value={String(field.value || 15)}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona tiempo de práctica diario" /></SelectTrigger></FormControl>
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
                {(isUpdating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
              <Button variant="outline" onClick={handleSignOut} className="w-full sm:w-auto" disabled={isSigningOut || authLoading}>
                {isSigningOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cerrar Sesión
              </Button>
            </div>
             {!user.emailVerified && (
                <p className="text-sm text-yellow-600 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    Tu correo electrónico no está verificado. Por favor, revisa tu bandeja de entrada por un enlace de verificación. Algunas funcionalidades podrían estar limitadas.
                </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
