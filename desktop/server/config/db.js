const path = require("path");
const fs = require("fs");
const { logger } = require("../helpers/logger");


// let dbPath = null;
// if(fs.existsSync(path.join(__dirname.replace('app.asar', 'app.asar.unpacked').replace('config', 'database'), "syncer.db"))) {
//   dbPath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked').replace('config', 'database'), "syncer.db");
// }else if (fs.existsSync(path.join(__dirname.replace("config", "database"), "syncer.db"))) {
//   dbPath = path.join(__dirname.replace("config", "database"), "syncer.db");
// } else {
//   throw 'Database Not Found';
// }

// logger.info(path.join(
//   __dirname,
//   "..",
//   "database",
//   "syncer.db"
// ));

// let dbPath = null;
// if (process.platform === 'darwin') {
//   dbPath = path.join(
//     __dirname,
//     "app.asar.unpacked",
//     "server",
//     "database",
//     "syncer.db"
//   );
// } else if (process.platform === 'linux') {
//   dbPath = path.join(
//     __dirname,
//     "app.asar.unpacked",
//     "server",
//     "database",
//     "syncer.db"
//   );
// }

let dbPath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked').replace('config', 'database'), "syncer.db");

if (!fs.existsSync(dbPath)) {
  // dbPath = path.join(__dirname.replace("config", "database"), "syncer.db");

  if (!fs.existsSync(dbPath)) {
    throw `Database Not Found. __dirname: ${__dirname} dbPath: ${dbPath}`;
  }
}

exports.db = require("knex")({
  client: "sqlite3",
  connection: {
    filename: dbPath
  },
  useNullAsDefault: true
});
