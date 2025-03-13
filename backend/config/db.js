const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    port: process.env.DB_PORT,
    logging: false
    }
);

sequelize.authenticate()
    .then(() => console.log('Conectado exitosamente a PostgreSQL'))
    .catch(err => console.error('Error de conexión a PostgreSQL:', err));

module.exports = sequelize;
