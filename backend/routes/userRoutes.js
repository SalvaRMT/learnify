const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController"); // 👈 Asegúrate de que está correctamente importado
const authMiddleware = require("../utils/authMiddleware");

// Ruta para registrar un usuario
router.post("/register", userController.registerUser);

// Ruta para obtener todos los usuarios (requiere autenticación)
router.get("/", authMiddleware, userController.getUsers);

module.exports = router;
