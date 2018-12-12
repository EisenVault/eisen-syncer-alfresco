const Sequelize = require('sequelize');
const db = require('../config/db');

const accountModel = db.connection.define('account', {
    instance_url: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false
    },
    sync_path: Sequelize.TEXT,
    sync_enabled: Sequelize.BOOLEAN,
    sync_frequency: {
        type: Sequelize.INTEGER,
        defaultValue: 5
    },
    last_synced_at: Sequelize.INTEGER,
    sync_in_progress: Sequelize.BOOLEAN,
    download_in_progress: Sequelize.BOOLEAN,
    upload_in_progress: Sequelize.BOOLEAN,
    created_at: Sequelize.INTEGER,
    updated_at: Sequelize.INTEGER
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

exports.accountModel = accountModel;