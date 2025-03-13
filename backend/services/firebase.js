const admin = require("firebase-admin");
const dotenv = require("dotenv");

// Cargar variables de entorno
dotenv.config();

console.log("🔍 FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID);
console.log("🔍 FIREBASE_CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL);
console.log("🔍 FIREBASE_DATABASE_URL:", process.env.FIREBASE_DATABASE_URL);
console.log("🔍 FIREBASE_PRIVATE_KEY:", process.env.FIREBASE_PRIVATE_KEY ? "✔ Cargada" : "❌ NO CARGADA");

// Validar si las variables están disponibles
if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
  console.error("❌ ERROR: Variables de entorno de Firebase no están definidas.");
  process.exit(1);
}

// Formatear la clave privada correctamente
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
};

// Inicializar Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const auth = admin.auth();

console.log("✅ Firebase configurado correctamente.");

module.exports = { auth };
