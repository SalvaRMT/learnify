
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

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
// ensureGoogleUserInFirestore import was removed as Google Sign-In functionality was removed.
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext"; 

const SignUpSchema = z.object({
  fullName: z.string().min(2, "El nombre completo debe tener al menos 2 caracteres."),
  age: z.coerce.number().min(5, "La edad debe ser al menos 5.").max(120, "La edad debe ser como máximo 120.").optional().or(z.literal('')).transform(val => val === '' ? undefined : Number(val)),
  gender: z.string().min(1, "Por favor selecciona un género.").optional().or(z.literal('')),
  email: z.string().email("Dirección de correo electrónico inválida."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

export function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  // const [isGooglePending, startGoogleTransition] = useTransition(); // Removed for Google Sign-In
  const { handleLoginSuccess } = useAuth(); 

  const form = useForm<z.infer<typeof SignUpSchema>>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      fullName: "",
      age: '',
      gender: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof SignUpSchema>) {
    startTransition(async () => {
      console.log("SignupForm: Submitting email/password sign-up (client-side)");
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const firebaseUser = userCredential.user;

        // Instead of calling ensureUserDocument from AuthContext, we directly set the doc here
        // as per the original PRD's intent for email signup flow.
        // The AuthContext will handle profile creation on first login if needed via onAuthStateChanged logic.
        await setDoc(doc(db, "users", firebaseUser.uid), {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          fullName: values.fullName,
          age: values.age === '' || values.age === undefined ? null : Number(values.age),
          gender: values.gender === '' || values.gender === undefined ? null : values.gender,
          createdAt: serverTimestamp(),
          practiceTime: 15, // Default practice time
          authProvider: "email",
        });
        
        console.log("SignupForm: Client-side createUserWithEmailAndPassword successful, user data saved to Firestore.");
        
        toast({
          title: "Registro Exitoso",
          description: "¡Cuenta creada! Procede a configurar tu tiempo de práctica.",
        });
        // No longer call handleLoginSuccess here for email signup,
        // navigation to practice-time is the defined flow.
        // AuthContext will pick up user on next login via onAuthStateChanged.
        router.replace(`/practice-time?userId=${firebaseUser.uid}`); 
      } catch (error: any) {
        console.error("SignupForm: Client-side createUserWithEmailAndPassword failed", error);
        let errorMessage = "Error al crear la cuenta. Por favor, inténtalo de nuevo.";
        if (error.code === 'auth/email-already-in-use') {
          errorMessage = "Este correo electrónico ya está en uso. Por favor, intenta con otro correo o inicia sesión.";
        } else if (error.code === 'auth/weak-password') {
          errorMessage = "La contraseña es muy débil. Por favor, elige una contraseña más fuerte.";
        } else if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/unauthorized-domain' || error.code === 'auth/operation-not-supported-in-this-environment') {
            errorMessage = `Error de registro: Este método de registro no está permitido para tu configuración o dominio actual. Revisa la configuración de la consola de Firebase para dominios autorizados y proveedores habilitados. (Código: ${error.code})`;
        } else if (error.code === 'auth/network-request-failed') {
           errorMessage = "Error de registro debido a un error de red. Por favor, revisa tu conexión a internet.";
        } else if (error.code === 'auth/configuration-not-found') {
            errorMessage = `No se encontró la configuración de Firebase Authentication para este proyecto. Asegúrate de que Authentication esté habilitado y configurado en la consola de Firebase. (Código: ${error.code})`;
        } else if (error.message) {
          errorMessage = `Error al registrarse: ${error.message} (Código: ${error.code})`;
        }
        toast({
          title: "Fallo en el Registro",
          description: errorMessage,
          variant: "destructive",
        });
      }
    });
  }

  // Google Sign Up handler removed as per decision to remove Google Sign-In

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-primary">Crear Cuenta</CardTitle>
        <CardDescription className="text-center">
          ¡Únete a Learnify y comienza tu aventura de aprendizaje!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="age"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Edad</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="25"
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
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tu género" />
                      </SelectTrigger>
                    </FormControl>
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
              name="password"
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
            <Button type="submit" className="w-full" disabled={isPending /*|| isGooglePending*/ }>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Cuenta
            </Button>
          </form>
        </Form>

        {/* Google Sign Up UI Removed */}

        <p className="mt-6 text-center text-sm">
          ¿Ya tienes una cuenta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Inicia Sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
