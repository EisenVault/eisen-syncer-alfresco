const Sequelize = require('sequelize');
const db = require('../config/db');
const { accountModel } = require('./account');

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

eventLogModel.belongsTo(accountModel, { foreignKey: 'account_id' });

exports.eventLogModel = eventLogModel;

exports.types = {
    DELETE_NODE: 'DELETE_NODE',
    DOWNLOAD_FILE: 'DOWNLOAD_FILE',
    UPLOAD_FOLDER: 'UPLOAD_FOLDER',
    UPLOAD_FILE: 'UPLOAD_FILE',
}