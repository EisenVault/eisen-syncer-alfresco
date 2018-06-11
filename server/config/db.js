const path = require("path");
const fs = require('fs');

let dbPath = null;
if(fs.existsSync(path.join(__dirname.replace('app.asar', 'app.asar.unpacked').replace('config', 'database'), "syncer.db"))) {
  dbPath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked').replace('config', 'database'), "syncer.db");
}else if (fs.existsSync(path.join(__dirname.replace("config", "database"), "syncer.db"))) {
  dbPath = path.join(__dirname.replace("config", "database"), "syncer.db");
} else {
  throw 'Database Not Found';
}

exports.db = require("knex")({
  client: "sqlite3",
  connection: {
    filename: dbPath
  },
  useNullAsDefault: true
});
