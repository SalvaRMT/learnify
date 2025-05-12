// app/login/page.js
export default function LoginPage() {
    return (
      <main className="container">
        <div className="overlay">
          <h1 className="title">Bienvenido</h1>
          <p className="subtitle">¡Ingresa para comenzar!</p>
  
          <form className="form">
            <input
              type="email"
              placeholder="Ingresa tu correo"
              className="input"
            />
            <input
              type="password"
              placeholder="Ingresa tu contraseña"
              className="input"
            />
            <button className="button">Iniciar sesión</button>
          </form>
        </div>
  
        <style jsx>{`
          .container {
            /* Ocupa toda la ventana y aplica la imagen de fondo */
            width: 100vw;
            height: 100vh;
            background-image: url('/fondo.png'); /* Se asume que fondo.png está en public/ */
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
  
            display: flex;
            align-items: center;
            justify-content: center;
          }
  
          .overlay {
            /* Un contenedor semitransparente sobre la imagen */
            background-color: rgba(255, 255, 255, 0.8);
            padding: 2rem;
            border-radius: 8px;
            text-align: center;
            max-width: 400px;
            width: 90%;
          }
  
          .title {
            margin: 0;
            font-size: 2rem;
            color: #333;
          }
  
          .subtitle {
            margin: 0 0 1.5rem;
            font-size: 1.2rem;
            color: #555;
          }
  
          .form {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }
  
          .input {
            padding: 0.75rem;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 1rem;
          }
  
          .button {
            padding: 0.75rem;
            border: none;
            border-radius: 4px;
            background-color: #0070f3;
            color: #fff;
            font-size: 1rem;
            cursor: pointer;
          }
  
          .button:hover {
            background-color: #005bb5;
          }
        `}</style>
      </main>
    );
  }
  