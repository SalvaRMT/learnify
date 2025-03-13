const { auth } = require("../services/firebase");

// 📌 Función para registrar usuario en Firebase
const registerUser = async (req, res) => {
  try {
    const { email, password, displayName, photoURL } = req.body;

    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      photoURL,
    });

    res.status(201).json({
      message: "Usuario registrado correctamente",
      user: {
        uid: userRecord.uid,
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

// 📌 Función para obtener todos los usuarios
const getUsers = async (req, res) => {
  try {
    const listUsersResult = await auth.listUsers();

    const users = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: user.metadata.creationTime,
      lastLogin: user.metadata.lastSignInTime,
    }));

    res.json({ users });
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ message: "Error al obtener usuarios", error: error.message });
  }
};

// 🔹 Asegúrate de exportarlos correctamente
module.exports = { registerUser, getUsers };
