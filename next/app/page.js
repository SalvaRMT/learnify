// app/page.js
export default function HomePage() {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Bienvenido a Next.js 13</h1>
        <p>Esta es la página principal.</p>
        <p>
          <a href="/login" style={{ color: 'blue', textDecoration: 'underline' }}>
            Ir a Login
          </a>
        </p>
      </main>
    );
  }
  