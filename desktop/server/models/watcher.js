const Sequelize = require('sequelize');
const db = require('../config/db');

const watcherModel = db.connection.define('watcher', {
    account_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    site_name: Sequelize.STRING,
    site_id: Sequelize.STRING,
    document_library_node: Sequelize.STRING,
    watch_node: Sequelize.STRING,
    watch_folder: Sequelize.TEXT,
    created_at: Sequelize.INTEGER,
    updated_at: Sequelize.INTEGER
}, {
        timestamps: false,
        hooks: {
            beforeCreate: (watcher) => {
                watcher.created_at = new Date().getTime();
            },
            beforeUpdate: (watcher) => {
                watcher.updated_at = new Date().getTime();
            },
        }
    });


exports.connection = db.connection.sync({
    force: db.flush,
    logging: db.logging
});

exports.watcherModel = watcherModel;