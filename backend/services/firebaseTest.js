const { auth } = require("./firebase"); // Asegúrate de importar desde services/firebase.js

auth.getUserByEmail("usuario@test.com")
  .then(user => console.log("✅ Firebase funciona:", user))
  .catch(error => console.error("❌ Error en Firebase:", error.message));
