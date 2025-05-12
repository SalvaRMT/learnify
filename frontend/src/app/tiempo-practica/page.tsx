import Image from "next/image";

export default function TiempoPractica() {
  return (
    <div className="relative min-h-screen bg-[url('/fondo.png')] bg-cover bg-center flex flex-col items-center justify-center p-4 text-center">
      {/* Imagen del mapache (más grande) */}
      <div className="relative w-66 h-66 mb-6">
        <Image
          src="/raccoon-face.png"
          alt="Raccoon face"
          fill
          style={{ objectFit: "contain" }}
        />
      </div>

      {/* Texto principal (más grande) */}
      <h1 className="text-3xl sm:text-4xl font-bold text-black mb-8">
        ¿Cuánto tiempo planeas practicar al día?
      </h1>

      {/* Opciones de tiempo */}
      <div className="flex flex-col gap-4 w-full max-w-md">
        <button className="bg-white/70 rounded p-4 text-black text-lg shadow hover:bg-white/80 transition">
          2 - 5 min
        </button>
        <button className="bg-white/70 rounded p-4 text-black text-lg shadow hover:bg-white/80 transition">
          5 - 10 min
        </button>
        <button className="bg-white/70 rounded p-4 text-black text-lg shadow hover:bg-white/80 transition">
          10 - más
        </button>
      </div>
    </div>
  );
}
