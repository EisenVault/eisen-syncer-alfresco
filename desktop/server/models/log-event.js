const Sequelize = require('sequelize');
const db = require('../config/db');

const eventLogModel = db.connection.define('log_event', {
    account_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    type: {
        type: Sequelize.STRING,
        allowNull: false
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    created_at: Sequelize.INTEGER
}, {
        timestamps: false,
        hooks: {
            beforeCreate: (log) => {
                log.created_at = new Date().getTime();
            }
        }
    });

exports.connection = db.connection.sync({
    force: db.flush,
    logging: db.logging
});

exports.eventLogModel = eventLogModel;