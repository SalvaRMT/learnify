// controllers/userController.js

const { auth } = require("../services/firebase");
const { User } = require("../models");

// Registrar usuario en Firebase y PostgreSQL
const registerUser = async (req, res) => {
  try {
    const { email, password, displayName, photoURL } = req.body;

    // Crear usuario en Firebase
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      photoURL,
    });

    // Guardar usuario en PostgreSQL
    const newUser = await User.create({
      firebase_uid: userRecord.uid,
      email: userRecord.email,
      display_name: userRecord.displayName,
      photo_url: userRecord.photoURL,
    });

    res.status(201).json({
      message: "Usuario registrado correctamente",
      user: {
        id: newUser.id,
        firebase_uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
      },
    });
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    res.status(500).json({ message: "Error al registrar usuario", error: error.message });
  }
};

// Función para obtener usuarios desde PostgreSQL
const getUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json({ users });
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ message: "Error al obtener usuarios", error: error.message });
  }
};

// Función para actualizar usuario por ID
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, photo_url } = req.body;

    const updatedUser = await User.update(
      { display_name: displayName, photo_url: photoURL },
      { where: { id }, returning: true }
    );

    res.json({ message: "Usuario actualizado correctamente", user: updatedUser[1][0] });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ message: "Error al actualizar usuario", error: error.message });
  }
};

// Eliminar usuario (Firebase y PostgreSQL)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    await auth.deleteUser(user.firebase_uid);
    await user.destroy();

    res.json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ message: "Error al eliminar usuario", error: error.message });
  }
};

module.exports = { registerUser, getUsers, updateUser, deleteUser };
