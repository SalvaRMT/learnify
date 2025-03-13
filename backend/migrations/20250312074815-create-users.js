"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Users", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      firebase_uid: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true, // Relacionado con el UID de Firebase Auth
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true, // El correo es único en Firebase Auth
      },
      display_name: {
        type: Sequelize.STRING,
        allowNull: true, // Puede que Firebase no siempre lo proporcione
      },
      photo_url: {
        type: Sequelize.STRING,
        allowNull: true, // URL de la foto de perfil desde Firebase
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Users");
  },
};