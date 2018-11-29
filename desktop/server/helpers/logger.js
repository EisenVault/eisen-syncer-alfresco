const logger = require("nodejslogger");
const fs = require("fs");
const path = require("path");

let logFolder;

// If app is running from a binary
if (__dirname.indexOf('app.asar') !== -1) {

  logFolder = path.join(__dirname.replace('app.asar', 'app.asar.unpacked').replace('helpers', 'logs'));

  if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder);
  }
} else {
  logFolder = path.join(__dirname.replace("helpers", "logs"));

  if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder);
  }
}
logger.init({ file: path.join(logFolder, "output.log"), mode: "DIE" });

exports.logger = logger;
