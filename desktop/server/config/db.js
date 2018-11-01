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

let dbPath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked').replace('config', 'database'), "syncer.db");
if (!fs.existsSync(dbPath)) {
  dbPath = path.join(__dirname.replace("config", "database"), "syncer.db");

  if (!fs.existsSync(dbPath)) {
    throw `Database Not Found. __dirname: ${__dirname} dbPath: ${dbPath}`;
  }
}

const knex = require("knex")({
  client: "sqlite3",
  connection: {
    filename: dbPath
  },
  useNullAsDefault: true
});

// output raw sql queries
knex.on('query', function (queryData) {
  // console.log(queryData.sql);
});

exports.db = knex;