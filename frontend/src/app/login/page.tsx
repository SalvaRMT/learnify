'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getFirebaseAuth } from '@/lib/firebaseClient';

export default function Home() {
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const auth   = getFirebaseAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, pass);
      // ↓ Token para que el backend reconozca al usuario
      const token = await user.getIdToken();
      localStorage.setItem('token', token);
      router.push('/tiempo-practica');          // <- pantalla siguiente
    } catch (err: any) {
      setError(err.message ?? 'Error al iniciar sesión');
    }
  }

  return (
    <div className="relative min-h-screen bg-[url('/fondo.png')] bg-cover bg-center flex flex-col items-center justify-center p-4">
      {/* Encabezado */}
      <h1 className="text-4xl font-bold mb-2 text-center text-white">
        Bienvenido <br /> ¡Ingresa para comenzar!
      </h1>

      {/* Mascota */}
      <div className="relative w-40 h-40 mt-4 mb-8">
        <Image src="/raccoon.png" alt="Raccoon" fill style={{ objectFit: 'contain' }} />
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="max-w-sm w-full p-6 text-black bg-white/20 backdrop-blur rounded-xl">
        <h2 className="text-xl font-semibold mb-4 text-center text-white">Acceder a tu cuenta</h2>

        <label className="block mb-4 text-sm font-medium text-white">
          Correo electrónico
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="block w-full mt-1 p-2 rounded"
            placeholder="you@email.com"
            required
          />
        </label>

        <label className="block mb-6 text-sm font-medium text-white">
          Contraseña
          <input
            type="password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            className="block w-full mt-1 p-2 rounded"
            placeholder="********"
            required
          />
        </label>

        {error && <p className="mb-4 text-red-300 text-center">{error}</p>}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors">
          Ingresar
        </button>

        <div className="flex justify-between items-center mt-4 text-sm text-white">
          <a href="#" className="hover:underline">¿Olvidaste tu contraseña?</a>
          <a href="/crear-cuenta" className="hover:underline">Registrar</a>
        </div>
      </form>
    </div>
  );
}
