
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
  const { user, userProfile, fetchUserProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isSigningOut, startSignOutTransition] = useTransition();
  const [isLoadingProfile, setIsLoadingProfile] = useState(true); // Manage local loading state for profile

  const form = useForm<z.infer<typeof ProfileUpdateSchema>>({
    resolver: zodResolver(ProfileUpdateSchema),
    defaultValues: {
      fullName: "",
      age: '',
      gender: "",
      practiceTime: 15,
    },
  });

  useEffect(() => {
    console.log("ProfileForm useEffect: authLoading, user, userProfile", authLoading, !!user, !!userProfile);
    if (userProfile) {
      form.reset({
        fullName: userProfile.fullName || "",
        age: userProfile.age === undefined || userProfile.age === null ? '' : userProfile.age,
        gender: userProfile.gender || "",
        practiceTime: userProfile.practiceTime || 15,
      });
      setIsLoadingProfile(false);
      console.log("ProfileForm: Profile data loaded and form reset.", userProfile);
    } else if (user && !authLoading && !userProfile) {
      // If user exists, auth is not loading, but profile is still null, try fetching
      console.log("ProfileForm: User exists, auth not loading, but no profile. Fetching profile...");
      setIsLoadingProfile(true);
      fetchUserProfile(user.uid).finally(() => {
        // UserProfile should be updated by AuthContext's onAuthStateChanged or fetchUserProfile itself
        // The next render cycle with updated userProfile will reset the form.
        // We just set loading to false here if fetchUserProfile didn't lead to profile.
        // This state is primarily for the initial load of the form itself.
        console.log("ProfileForm: fetchUserProfile attempt finished in useEffect.");
        // The AuthContext's userProfile state will trigger another re-render if successful
        // For now, if it's still null after fetch, stop local loading
        if (!userProfile) setIsLoadingProfile(false); 
      });
    } else if (!user && !authLoading) {
        // No user and auth is done loading, so no profile to load
        setIsLoadingProfile(false);
    }
  }, [userProfile, user, authLoading, form, fetchUserProfile]);


  function onSubmit(values: z.infer<typeof ProfileUpdateSchema>) {
    if (!user) return;
    
    const finalValues: { [key: string]: any } = {};
    if (values.fullName !== undefined && values.fullName !== (userProfile?.fullName || "")) {
      finalValues.fullName = values.fullName;
    }
    if (values.age !== undefined) { // This handles both number and the potential 'undefined' from transform
      if (values.age === undefined && userProfile?.age !== undefined) { // User wants to clear age
        finalValues.age = undefined; // Explicitly set to undefined for Firestore to remove field or handle as null
      } else if (values.age !== undefined && Number(values.age) !== userProfile?.age) {
        finalValues.age = Number(values.age);
      }
    }
    if (values.gender !== undefined && values.gender !== (userProfile?.gender || "")) {
      finalValues.gender = values.gender;
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
            description: result.error, // Use the detailed error from actions.ts
            variant: "destructive",
            duration: 9000, // Show longer for detailed error
        });
      } else {
        toast({ title: "Perfil Actualizado", description: result.success });
        // Re-fetch profile after successful update to reflect changes
        await fetchUserProfile(user.uid); 
      }
    });
  }

  const handleSignOut = () => {
    startSignOutTransition(async () => {
      const result = await signOutUser();
      if (result.error) {
        toast({ title: "Fallo al Cerrar Sesión", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Sesión Cerrada", description: result.success });
        router.push("/login");
      }
    });
  };
  
  if (authLoading || isLoadingProfile) {
      return (
          <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-3">Cargando perfil...</p>
          </div>
      );
  }

  if (!user) {
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
