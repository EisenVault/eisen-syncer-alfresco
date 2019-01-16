const Sequelize = require('sequelize');
const db = require('../config/db');

const workerModel = db.connection.define('worker', {
    account_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    watcher_id: {
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
    created_at: Sequelize.INTEGER,
}, {
        timestamps: false,
        hooks: {
            beforeCreate: (account) => {
                account.created_at = new Date().getTime();
            }
        }
    });


exports.connection = db.connection.sync({
    force: db.flush,
    logging: db.logging
});

exports.workerModel = workerModel;
