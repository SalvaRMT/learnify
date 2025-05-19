
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useTransition, useState } from "react";
import { useRouter } from "next/navigation"; // Import useRouter
import { signOut } from "firebase/auth"; // Importar signOut de firebase/auth
import { auth } from "@/lib/firebaseConfig"; // Importar instancia auth del cliente

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
import { updateUserProfile } from "@/lib/actions"; 
import { useAuth } from "@/context/AuthContext";
import { Loader2, AlertCircle } from "lucide-react"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { UserProfile } from "@/types";


const ProfileUpdateSchema = z.object({
  fullName: z.string().min(2, "El nombre completo debe tener al menos 2 caracteres.").optional().or(z.literal('')),
  age: z.coerce.number().min(5, "La edad debe ser al menos 5.").max(120, "La edad debe ser como máximo 120.").nullable().optional().or(z.literal('')).transform(val => val === '' ? null : (val === undefined ? undefined : Number(val))),
  gender: z.string().min(1, "Por favor selecciona un género.").nullable().optional().or(z.literal('')).transform(val => val === '' ? null : (val === undefined ? undefined : val)),
  practiceTime: z.coerce.number().min(5, "El tiempo de práctica debe ser de al menos 5 minutos.").optional(),
}).transform(data => ({
  ...data,
  fullName: data.fullName === '' ? undefined : data.fullName,
  age: data.age === '' ? null : (data.age === undefined ? undefined : Number(data.age)),
  gender: data.gender === '' ? null : (data.gender === undefined ? undefined : data.gender),
}));


const practiceTimeOptions = [
  { label: "5 minutos", value: 5 },
  { label: "10 minutos", value: 10 },
  { label: "15 minutos", value: 15 },
  { label: "30 minutos", value: 30 },
  { label: "60 minutos", value: 60 },
];

export function ProfileForm() {
  const { user, userProfile, loading: authLoading, refreshUserAppData, handleLoginSuccess } = useAuth(); // refreshUserAppData was renamed to fetchUserAppData, then refreshUserAppData
  const router = useRouter();
  const { toast } = useToast();
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isSigningOut, startSignOutTransition] = useTransition();
  
  console.log(`%cProfileForm: Render. authLoading: ${authLoading}, User: ${user ? user.uid : null}, Profile: ${userProfile ? 'loaded' : 'null'}`, "color: violet;");

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
    console.log(`%cProfileForm useEffect [user, userProfile, authLoading, form.reset]: User: ${!!user}, UserProfile: ${!!userProfile}, AuthLoading: ${authLoading}`, "color: violet;");
    if (!authLoading && user) { 
      if (userProfile) {
        console.log("%cProfileForm: Auth not loading, user and profile exist. Resetting form with profile data:", "color: violet;", userProfile);
        form.reset({
          fullName: userProfile.fullName || "",
          age: userProfile.age === undefined || userProfile.age === null ? '' : String(userProfile.age),
          gender: userProfile.gender === undefined || userProfile.gender === null ? "" : userProfile.gender,
          practiceTime: userProfile.practiceTime || 15,
        });
      } else {
        console.log("%cProfileForm: Auth not loading, user exists, but NO userProfile from context. Resetting form to defaults (likely profile read permission issue or profile does not exist).", "color: orange;");
        form.reset({ 
          fullName: user?.displayName || "", 
          age: '',
          gender: "",
          practiceTime: 15,
        });
      }
    } else if (!authLoading && !user) { 
        console.log("%cProfileForm: Auth not loading and no user. Resetting form to defaults (user logged out).", "color: orange;");
        form.reset({
            fullName: "",
            age: '',
            gender: "",
            practiceTime: 15,
        });
    }
  }, [user, userProfile, authLoading, form.reset]);


  async function onSubmit(values: z.infer<typeof ProfileUpdateSchema>) {
    if (!user) return;
    
    const dataToUpdate: Partial<UserProfile> = {};

    if (values.fullName !== undefined) dataToUpdate.fullName = values.fullName;
    if (values.age !== undefined) dataToUpdate.age = values.age; 
    if (values.gender !== undefined) dataToUpdate.gender = values.gender; 
    if (values.practiceTime !== undefined) dataToUpdate.practiceTime = values.practiceTime;


    if (Object.keys(dataToUpdate).length === 0) {
      toast({ title: "Sin Cambios", description: "No se detectaron cambios para actualizar." });
      return;
    }

    startUpdateTransition(async () => {
      console.log("ProfileForm onSubmit: Updating profile with values:", dataToUpdate);
      const result = await updateUserProfile(user.uid, dataToUpdate);
      if (result.error) {
        toast({ 
            title: "Fallo al Actualizar", 
            description: result.error, 
            variant: "destructive",
            duration: 9000, 
        });
      } else {
        toast({ title: "Perfil Actualizado", description: result.success });
        if (user.uid && refreshUserAppData) { 
            await refreshUserAppData(); 
        }
      }
    });
  }

  const handleSignOut = () => {
    startSignOutTransition(async () => {
      console.log("%cProfileForm: Attempting client-side sign out.", "color: orange;");
      try {
        await signOut(auth); // Usar signOut del cliente directamente
        toast({ title: "Sesión Cerrada", description: "Has cerrado sesión correctamente." });
        // onAuthStateChanged en AuthContext manejará la limpieza del estado y los layouts/páginas redirigirán.
        // router.push("/login"); // No es estrictamente necesario aquí, AuthContext debería manejarlo.
      } catch (error: any) {
        console.error("ProfileForm: Client-side signOut failed", error);
        toast({ 
          title: "Fallo al Cerrar Sesión", 
          description: `Error al cerrar sesión: ${error.message}`, 
          variant: "destructive" 
        });
      }
    });
  };
  
  if (authLoading && user) { 
      return (
          <div className="flex flex-col justify-center items-center py-10 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-3 mt-2">Cargando perfil...</p>
          </div>
      );
  }

  if (!user && !authLoading) { 
    return <p className="text-center text-muted-foreground py-10">Por favor, inicia sesión para ver tu perfil.</p>;
  }
  
  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-primary">Tu Perfil</CardTitle>
        <CardDescription>
          Gestiona la configuración y preferencias de tu cuenta. <br />
          Correo: {user?.email} {user?.emailVerified ? <span className="text-green-600">(Verificado)</span> : <span className="text-yellow-600">(No Verificado)</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!authLoading && user && !userProfile && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error al Cargar Perfil</AlertTitle>
            <AlertDescription>
              No se pudo cargar tu perfil desde la base de datos. Esto puede ocurrir si el perfil no existe
              o debido a un problema de permisos de Firestore (asegúrate de que las reglas permitan leer 
              <code>{` /users/${user.uid} `}</code>).
              Si es un usuario nuevo, algunos campos podrían aparecer vacíos hasta que los guardes por primera vez.
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
                        value={field.value === undefined || field.value === null ? '' : String(field.value)}
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
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value === null ? "" : field.value || ""}
                    >
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
                <Alert variant="default" className="mt-4 bg-yellow-50 border-yellow-200 text-yellow-700 [&>svg]:text-yellow-700">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Correo no Verificado</AlertTitle>
                    <AlertDescription>
                        Tu correo electrónico no está verificado. Por favor, revisa tu bandeja de entrada por un enlace de verificación. Algunas funcionalidades podrían estar limitadas.
                    </AlertDescription>
                </Alert>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
