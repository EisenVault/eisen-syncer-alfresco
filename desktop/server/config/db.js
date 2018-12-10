const path = require("path");
const fs = require("fs");
const { logger } = require("../helpers/logger");

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
    filename: dbPath,
    connectTimeout: 90000
  },
  useNullAsDefault: true,
  // pool: { min: 1, max: 100 },
  // acquireConnectionTimeout: 10000
});

// output raw sql queries
knex.on('query', function (queryData) {
  // console.log(queryData.sql);
});

exports.db = knex;