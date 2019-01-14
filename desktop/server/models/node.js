const Sequelize = require('sequelize');
const db = require('../config/db');

const nodeModel = db.connection.define('node', {
    account_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    site_id: Sequelize.STRING,
    node_id: Sequelize.STRING,
    remote_folder_path: Sequelize.TEXT,
    file_name: Sequelize.STRING,
    file_path: Sequelize.TEXT,
    local_folder_path: Sequelize.TEXT,
    file_update_at: Sequelize.INTEGER,
    last_uploaded_at: Sequelize.INTEGER,
    last_downloaded_at: Sequelize.INTEGER,
    is_folder: Sequelize.BOOLEAN,
    is_file: Sequelize.BOOLEAN,
    download_in_progress: Sequelize.BOOLEAN,
    upload_in_progress: Sequelize.BOOLEAN,
    created_at: Sequelize.INTEGER,
    updated_at: Sequelize.INTEGER
}, {
        timestamps: false,
        hooks: {
            beforeCreate: (node) => {
                node.created_at = new Date().getTime();
                node.updated_at = new Date().getTime();
            }
        },
        indexes: [
            // Create a unique index on email
            {
                unique: true,
                fields: ['account_id', 'site_id', 'node_id', 'remote_folder_path', 'file_path']
            }
        ]
    });


exports.connection = db.connection.sync({
    force: db.flush,
    logging: db.logging
});

exports.nodeModel = nodeModel;