const path = require("path");
const fs = require("fs");
<<<<<<< HEAD

=======
const { logger } = require("../helpers/logger");


>>>>>>> 0676c75c6a2039956a9b39819ba57a2352b5179e
// let dbPath = null;
// if(fs.existsSync(path.join(__dirname.replace('app.asar', 'app.asar.unpacked').replace('config', 'database'), "syncer.db"))) {
//   dbPath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked').replace('config', 'database'), "syncer.db");
// }else if (fs.existsSync(path.join(__dirname.replace("config", "database"), "syncer.db"))) {
//   dbPath = path.join(__dirname.replace("config", "database"), "syncer.db");
// } else {
//   throw 'Database Not Found';
// }

<<<<<<< HEAD
let dbPath = path.join(
  __dirname,
  "app.asar.unpacked",
  "server",
  "database",
  "syncer.db"
);
=======
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

>>>>>>> 0676c75c6a2039956a9b39819ba57a2352b5179e
if (!fs.existsSync(dbPath)) {
  dbPath = path.join(__dirname.replace("config", "database"), "syncer.db");

  if (!fs.existsSync(dbPath)) {
<<<<<<< HEAD
    throw Error("Database Not Found");
=======
    throw `Database Not Found. __dirname: ${__dirname} dbPath: ${dbPath}`;
>>>>>>> 0676c75c6a2039956a9b39819ba57a2352b5179e
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