require("dotenv").config();

module.exports = {
  development: {
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "123456",
    database: process.env.DB_NAME || "thiktreks_db",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: "postgres",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432
  },
  test: {
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "123456",
    database: "thiktreks_test",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: "postgres",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432
  },
  production: {
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "123456",
    database: "thiktreks_prod",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: "postgres",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432
  }
};
