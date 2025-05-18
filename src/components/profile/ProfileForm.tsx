
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
import { updateUserProfile, signOutUser } from "@/lib/actions"; // signOutUser was added back
import { useAuth } from "@/context/AuthContext";
import { Loader2, AlertCircle } from "lucide-react"; // Added AlertCircle
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ProfileUpdateSchema = z.object({
  fullName: z.string().min(2, "El nombre completo debe tener al menos 2 caracteres.").optional(),
  age: z.coerce.number().min(5, "La edad debe ser al menos 5.").max(120, "La edad debe ser como máximo 120.").optional().or(z.literal('')).transform(val => val === '' ? undefined : Number(val)),
  gender: z.string().min(1, "Por favor selecciona un género.").optional().or(z.literal('')),
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
  const { user, userProfile, loading: authLoading, fetchUserAppData, handleLoginSuccess: internalHandleLoginSuccess } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isSigningOut, startSignOutTransition] = useTransition();

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
    console.log(`ProfileForm useEffect [user, userProfile, authLoading, form.reset]: User: ${!!user}, UserProfile: ${!!userProfile}, AuthLoading: ${authLoading}`);
    if (!authLoading && user) { // Auth context has loaded, and there is a Firebase user
      if (userProfile) {
        console.log("ProfileForm: Auth not loading, user and profile exist. Resetting form with profile data:", userProfile);
        form.reset({
          fullName: userProfile.fullName || "",
          age: userProfile.age === undefined || userProfile.age === null ? '' : Number(userProfile.age),
          gender: userProfile.gender || "",
          practiceTime: userProfile.practiceTime || 15,
        });
      } else {
        console.log("ProfileForm: Auth not loading, user exists, but NO userProfile from context. Resetting form to defaults.");
        form.reset({ // User is loaded, but no profile (either doesn't exist or failed to load)
          fullName: "",
          age: '',
          gender: "",
          practiceTime: 15,
        });
      }
    } else if (!authLoading && !user) { // Auth context loaded, no user
        console.log("ProfileForm: Auth not loading and no user. Resetting form to defaults (user logged out).");
        form.reset({
            fullName: "",
            age: '',
            gender: "",
            practiceTime: 15,
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userProfile, authLoading, form.reset]);


  function onSubmit(values: z.infer<typeof ProfileUpdateSchema>) {
    if (!user) return;
    
    const finalValues: { [key: string]: any } = {};
    // Only include fields that have actually changed from the current profile or are being set for the first time
    if (values.fullName !== undefined && values.fullName !== (userProfile?.fullName || "")) {
      finalValues.fullName = values.fullName;
    }
    
    const ageFromForm = values.age === '' || values.age === undefined ? undefined : Number(values.age);
    const ageFromProfile = userProfile?.age === undefined || userProfile?.age === null || userProfile?.age === '' ? undefined : Number(userProfile.age);
    if (ageFromForm !== ageFromProfile) {
       finalValues.age = ageFromForm === undefined ? null : ageFromForm; 
    }

    const genderFromForm = values.gender === "" || values.gender === undefined ? undefined : values.gender;
    const genderFromProfile = userProfile?.gender === "" || userProfile?.gender === undefined || userProfile?.gender === null ? undefined : userProfile.gender;
    if (genderFromForm !== genderFromProfile) {
      finalValues.gender = genderFromForm === undefined ? null : genderFromForm;
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
            description: result.error, // This will now show the detailed error from actions.ts
            variant: "destructive",
            duration: 9000, 
        });
      } else {
        toast({ title: "Perfil Actualizado", description: result.success });
        if(user.uid && fetchUserAppData) { 
            await fetchUserAppData(user.uid); // Refresh context data including profile
        }
      }
    });
  }

  const handleSignOut = () => {
    startSignOutTransition(async () => {
      const result = await signOutUser(); // Assuming signOutUser is correctly imported
      if (result.error) {
        toast({ title: "Fallo al Cerrar Sesión", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Sesión Cerrada", description: "Has cerrado sesión correctamente." });
        router.push("/login"); 
      }
    });
  };
  
  // Show main loading spinner if AuthContext is still loading and we have a user (implies fetching initial data)
  if (authLoading && user) { 
      return (
          <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-3">Cargando perfil...</p>
          </div>
      );
  }

  if (!user && !authLoading) { 
    return <p className="text-center text-muted-foreground">Por favor, inicia sesión para ver tu perfil.</p>;
  }
  
  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-primary">Tu Perfil</CardTitle>
        <CardDescription>
          Gestiona la configuración y preferencias de tu cuenta. Tu correo: {user?.email} {user?.emailVerified ? "(Verificado)" : "(No Verificado)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!authLoading && user && !userProfile && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error al Cargar Perfil</AlertTitle>
            <AlertDescription>
              No se pudo cargar tu perfil desde la base de datos. Esto puede deberse a un problema de permisos de Firestore
              (asegúrate de que la regla 'allow read: if request.auth.uid == userId;' esté activa para '/users/{"{userId}"}')
              o que el perfil aún no ha sido creado.
            </AlertDescription>
          </Alert>
        )}
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
              <Button type="submit" className="w-full sm:w-auto" disabled={isUpdating || authLoading}>
                {(isUpdating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
              <Button variant="outline" onClick={handleSignOut} className="w-full sm:w-auto" disabled={isSigningOut || authLoading}>
                {isSigningOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cerrar Sesión
              </Button>
            </div>
             {user && !user.emailVerified && ( 
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

    