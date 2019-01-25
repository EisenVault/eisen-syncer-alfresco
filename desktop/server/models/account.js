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
                account.updated_at = new Date().getTime();
            }
        }
    });


exports.connection = db.connection.sync({
    force: db.flush,
    logging: db.logging
});

exports.accountModel = accountModel;

exports.syncStart = async (params) => {
    const account = params.account;
    const downloadProgress = ('downloadProgress' in params) ? params.downloadProgress : account.download_in_progress;
    const uploadProgress = ('uploadProgress' in params) ? params.uploadProgress : account.upload_in_progress;

    await accountModel.update({
        sync_in_progress: 1,
        download_in_progress: downloadProgress,
        upload_in_progress: uploadProgress
    }, {
            where: {
                id: account.id
            }
        })
        .then()
        .catch(error => console.log(error));
};

exports.syncComplete = async (params) => {
    const account = params.account;
    const downloadProgress = ('downloadProgress' in params) ? params.downloadProgress : account.download_in_progress;
    const uploadProgress = ('uploadProgress' in params) ? params.uploadProgress : account.upload_in_progress;

    await accountModel.update({
        sync_in_progress: 0,
        download_in_progress: downloadProgress,
        upload_in_progress: uploadProgress,
        last_synced_at: Math.round(new Date().getTime())
    }, {
            where: {
                id: account.id
            }
        })
        .then()
        .catch(error => console.log(error));
};