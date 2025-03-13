const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());  // Asegurar que se acepten JSONs
app.use(cors());          // Permitir CORS para pruebas

// Cargar rutas
app.use("/api/users", require("./routes/userRoutes"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
