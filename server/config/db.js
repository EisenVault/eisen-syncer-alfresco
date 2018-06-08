const path = require("path");

exports.db = require("knex")({
  client: "sqlite3",
  connection: {
    filename: path.join(__dirname.replace("config", "database"), "syncer.db")
    // filename: path.join(__dirname.replace('app.asar', 'app.asar.unpacked').replace('config', 'database'), "syncer.db")
  },
  useNullAsDefault: true
});
