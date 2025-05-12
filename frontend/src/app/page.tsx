import Image from "next/image";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[url('/fondo.png')] bg-cover bg-center flex flex-col items-center justify-center p-4">
      {/* Texto de bienvenida */}
      <h1 className="text-4xl font-bold mb-2 text-center text-white">
        Bienvenido <br /> ¡Ingresa para comenzar!
      </h1>

      {/* Imagen del mapache */}
      <div className="relative w-68 h-68 mt-4 mb-8">
        <Image
          src="/raccoon.png"
          alt="Raccoon"
          fill
          style={{ objectFit: "contain" }}
        />
      </div>

      {/* Formulario de acceso sin recuadro visible */}
      <div className="max-w-sm w-full p-6 text-black">
        <h2 className="text-xl font-semibold mb-4 text-center">Acceder a tu cuenta</h2>

        <label className="block mb-2 text-sm font-medium">
          Your Email address
          <input
            type="email"
            className="block w-full mt-1 p-2 border border-gray-300 rounded"
            placeholder="Your Email address"
          />
        </label>

        <label className="block mb-4 text-sm font-medium">
          Enter your password
          <input
            type="password"
            className="block w-full mt-1 p-2 border border-gray-300 rounded"
            placeholder="Enter your password"
          />
        </label>

        <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors">
          Ingresar
        </button>

        <div className="flex justify-between items-center mt-4 text-sm">
          <a href="#" className="text-blue-600 hover:underline">
            Forgot your password?
          </a>
          <a href="#" className="text-blue-600 hover:underline">
            Sign Up
          </a>
        </div>
      </div>
    </div>
  );
}
