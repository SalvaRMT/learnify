const { auth } = require('../services/firebase');

const verifyFirebaseToken = async (req, res, next) => {
const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ error: "Acceso denegado: Token no proporcionado" });
    }

    try {
        const decodedToken = await auth.verifyIdToken(token);
        req.user = decodedToken; // Guarda los datos del usuario en la petición
        next();
    } catch (error) {
        res.status(401).json({ error: "Token inválido o expirado" });
    }
    };

module.exports = verifyFirebaseToken;
