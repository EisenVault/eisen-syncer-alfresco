const Sequelize = require('sequelize');
const path = require("path");
const fs = require("fs");

let logging = false;

let dbPath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked').replace('config', 'database'), "syncer.db");
if (!fs.existsSync(dbPath)) {
    dbPath = path.join(__dirname.replace("config", "database"), "syncer.db");

    if (!fs.existsSync(dbPath)) {
        throw `Database Not Found. __dirname: ${__dirname} dbPath: ${dbPath}`;
    }
}

const connection = new Sequelize(`sqlite:${dbPath}`, {
    dialect: 'sqlite',
    pool: {
        max: 5,
        idle: 30000,
        acquire: 60000,
    },
    operatorsAliases: false,
    logging
});

exports.flush = false;
exports.logging = logging;
exports.connection = connection;

