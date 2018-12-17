const Sequelize = require('sequelize');
const db = require('../config/db');

const settingModel = db.connection.define('setting', {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
    },
    value: {
        type: Sequelize.TEXT,
        allowNull: true
    }
}, {
        timestamps: false
    });

exports.connection = db.connection.sync({
    force: db.flush,
    logging: db.logging
});

exports.settingModel = settingModel;