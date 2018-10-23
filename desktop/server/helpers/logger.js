const logger = require('nodejslogger')
const fs = require('fs');
const path = require("path");

const logFolder = path.resolve(__dirname, '..', 'logs');

if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder);
}

logger.init({ "file": logFolder + "/output.log", "mode": "DIE" })

exports.logger = logger;