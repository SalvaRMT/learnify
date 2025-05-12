import Image from "next/image";

export default function CrearCuenta() {
  return (
    <div className="relative min-h-screen bg-[url('/fondo.png')] bg-cover bg-center flex flex-col items-center justify-center p-4">
      {/* Título */}
      <h1 className="text-4xl font-bold mb-4 text-center text-white">
        Crear cuenta ...
      </h1>

      {/* Imagen del mapache */}
      <div className="relative w-68 h-68 mb-8">
        <Image
          src="/raccoon.png"
          alt="Raccoon"
          fill
          style={{ objectFit: "contain" }}
        />
      </div>

      {/* Formulario de creación de cuenta SIN recuadro */}
      <div className="max-w-sm w-full p-6 text-black">
        {/* Campo: Nombre */}
        <label className="block mb-4">
          <span className="text-sm font-medium">Nombre</span>
          <input
            type="text"
            className="block w-full mt-1 p-2 border border-gray-300 rounded"
            placeholder="Tu nombre"
          />
        </label>

        {/* Campo: Edad */}
        <label className="block mb-4">
          <span className="text-sm font-medium">Edad</span>
          <input
            type="number"
            className="block w-full mt-1 p-2 border border-gray-300 rounded"
            placeholder="Tu edad"
          />
        </label>

        {/* Campo: Género */}
        <label className="block mb-4">
          <span className="text-sm font-medium">Género</span>
          <select className="block w-full mt-1 p-2 border border-gray-300 rounded">
            <option value="">Selecciona tu género</option>
            <option value="Femenino">Femenino</option>
            <option value="Masculino">Masculino</option>
            <option value="Otro">Otro</option>
          </select>
        </label>

        {/* Campo: Temas de interés */}
        <label className="block mb-4">
          <span className="text-sm font-medium">Temas de interés</span>
          <input
            type="text"
            className="block w-full mt-1 p-2 border border-gray-300 rounded"
            placeholder="Ej. Programación, Arte, Música..."
          />
        </label>

        {/* Botón para continuar con Google */}
        <div className="flex justify-center mb-4">
          <button className="bg-black text-white py-2 px-4 rounded flex items-center gap-2 hover:bg-gray-800 transition-colors">
            {/* Opcional: si tienes un ícono de Google, colócalo en public/google-icon.png y descomenta esta línea */}
            {/* <Image src="/google-icon.png" alt="Google" width={20} height={20} /> */}
            Continuar con Google
          </button>
        </div>

        {/* Botón para Ingresar */}
        <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors">
          Ingresar
        </button>
      </div>
    </div>
  );
}
