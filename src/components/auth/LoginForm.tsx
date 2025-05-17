
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { useTransition } from "react";
import { signInWithEmailAndPassword, type UserCredential } from "firebase/auth";
import { auth } from "@/lib/firebaseConfig"; // Firebase auth instance for client-side operations
import { useRouter } from "next/navigation";

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
// ensureGoogleUserInFirestore was removed as Google Sign-In functionality was removed.
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext"; 

const LoginSchema = z.object({
  email: z.string().email({ message: "Correo electrónico inválido." }),
  contrasena: z.string().min(1, { message: "La contraseña es obligatoria." }),
});

export function LoginForm() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { handleLoginSuccess } = useAuth(); 

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      contrasena: "",
    },
  });

  async function onSubmit(values: z.infer<typeof LoginSchema>) {
    startTransition(async () => {
      console.log("LoginForm: Submitting email/password login (client-side)");
      try {
        const userCredential = await signInWithEmailAndPassword(auth, values.email, values.contrasena);
        console.log("LoginForm: Client-side signInWithEmailAndPassword successful. UserCredential:", userCredential);

        if (userCredential.user) {
          await handleLoginSuccess(userCredential.user); 
          toast({
            title: "Inicio de Sesión Exitoso",
            description: "¡Has iniciado sesión correctamente! Redirigiendo...",
          });
          // No navigation here, relying on AuthContext and page components
        } else {
           console.error("LoginForm: signInWithEmailAndPassword successful but no user in credential.");
           toast({ title: "Fallo en Inicio de Sesión", description: "Ocurrió un error inesperado.", variant: "destructive" });
        }
      } catch (error: any) {
        console.error("LoginForm: Client-side signInWithEmailAndPassword failed", error);
        let errorMessage = "Error al iniciar sesión. Por favor, inténtalo de nuevo.";
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          errorMessage = "Correo electrónico o contraseña inválidos.";
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage = "El acceso a esta cuenta ha sido deshabilitado temporalmente debido a muchos intentos fallidos de inicio de sesión. Puedes restaurarlo inmediatamente restableciendo tu contraseña o puedes intentarlo más tarde.";
        } else if (error.code === 'auth/user-disabled') {
          errorMessage = "Esta cuenta de usuario ha sido deshabilitada.";
        } else if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/unauthorized-domain' || error.code === 'auth/operation-not-supported-in-this-environment') {
            errorMessage = `Error de inicio de sesión: Este método de inicio de sesión no está permitido para tu configuración o dominio actual. Revisa la configuración de la consola de Firebase para dominios autorizados y proveedores habilitados. (Código: ${error.code})`;
        } else if (error.code === 'auth/network-request-failed') {
           errorMessage = "Fallo en inicio de sesión debido a un error de red. Por favor, revisa tu conexión a internet.";
        } else if (error.code === 'auth/configuration-not-found') {
          errorMessage = `No se encontró la configuración de Firebase Authentication para este proyecto. Asegúrate de que Authentication esté habilitado y configurado en la consola de Firebase. (Código: ${error.code})`;
        } else if (error.code === 'permission-denied') { 
          errorMessage = "Inicio de sesión exitoso con Firebase Auth, pero falló al recuperar el perfil de usuario debido a permisos de Firestore. Revisa tus reglas de seguridad de Firestore. (Código: permission-denied)";
        } else if (error.code === 'unavailable') { 
           errorMessage = `Fallo en inicio de sesión. El servicio está temporalmente no disponible. Revisa tu conexión a internet e inténtalo de nuevo. (Código: ${error.code})`;
        }
        toast({
          title: "Fallo en Inicio de Sesión",
          description: errorMessage,
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-primary">¡Bienvenido de Nuevo!</CardTitle>
        <CardDescription className="text-center">
          Inicia sesión para continuar tu aventura de aprendizaje.
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
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="tu@ejemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contrasena"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar Sesión
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm">
          ¿No tienes una cuenta?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Regístrate
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
