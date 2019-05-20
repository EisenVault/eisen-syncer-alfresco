const Sequelize = require("sequelize");
const db = require("../config/db");

const workerModel = db.connection.define(
  "worker",
  {
    account_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    file_path: {
      type: Sequelize.STRING,
      allowNull: false
    },
    root_node_id: {
      type: Sequelize.STRING,
      allowNull: false
    },
    priority: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    created_at: Sequelize.INTEGER
  },
  {
    timestamps: false,
    hooks: {
      beforeCreate: account => {
        account.created_at = new Date().getTime();
      }
    },
    indexes: [
      {
        name: "unique_workers",
        unique: true,
        fields: ["account_id", "file_path", "root_node_id"]
      }
    ]
  }
);

exports.workerModel = workerModel;
