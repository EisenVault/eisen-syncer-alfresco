const path = require("path");
const fs = require("fs");

// let dbPath = null;
// if(fs.existsSync(path.join(__dirname.replace('app.asar', 'app.asar.unpacked').replace('config', 'database'), "syncer.db"))) {
//   dbPath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked').replace('config', 'database'), "syncer.db");
// }else if (fs.existsSync(path.join(__dirname.replace("config", "database"), "syncer.db"))) {
//   dbPath = path.join(__dirname.replace("config", "database"), "syncer.db");
// } else {
//   throw 'Database Not Found';
// }

let dbPath = path.join(
  __dirname,
  "app.asar.unpacked/server/database/syncer.db"
);
if (!fs.existsSync(dbPath)) {
  dbPath = path.join(__dirname.replace("config", "database"), "syncer.db");

  if (!fs.existsSync(dbPath)) {
    throw Error("Database Not Found");
  }
}

exports.db = require("knex")({
  client: "sqlite3",
  connection: {
    filename: dbPath
  },
  useNullAsDefault: true
});
