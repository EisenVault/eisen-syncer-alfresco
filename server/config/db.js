const path = require("path");

exports.db = require("knex")({
  client: "sqlite3",
  connection: {
    filename: path.join(__dirname.replace("config", "database"), "syncer")
  },
  useNullAsDefault: true
});
