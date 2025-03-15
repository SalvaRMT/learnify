const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../utils/authMiddleware");

// Crear usuario
router.post("/register", userController.registerUser);

// Obtener todos los usuarios
router.get("/", authMiddleware, userController.getUsers);

// Actualizar usuario por ID
router.put("/:id", authMiddleware, userController.updateUser);

// Eliminar usuario por ID
router.delete("/:id", authMiddleware, userController.deleteUser);

module.exports = router;
