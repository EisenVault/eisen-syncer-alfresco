const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
const io = require("socket.io-client");
const watcher = require("./helpers/watcher");
const onevent = require("./helpers/syncers/onevent");
const accountModel = require("./models/account");
const machineID = require("node-machine-id");
const app = express();

// Middlewares
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// Pull in the routes
app.use("/logs/events", require("./routes/logs/event"));
app.use("/logs/errors", require("./routes/logs/error"));
app.use("/settings", require("./routes/setting"));
app.use("/accounts", require("./routes/account"));
app.use("/syncer", require("./routes/syncer"));
app.use("/sites", require("./routes/site"));
app.use("/nodes/parents", require("./routes/parent-node"));
app.use("/nodes", require("./routes/node"));

(async () => {
  let accounts = await accountModel.getAll();

  // For every account, set the sync progress to compeleted
  for (const account of accounts) {
    await accountModel.syncComplete(account.id);
  }
})();

// Start watching all the sync_paths
watcher.watchAll();

// Listen to event notifications from the socket service
let socket = io.connect(process.env.SERVICE_URL);

socket.on("sync-notification", async data => {
  data = typeof data === "object" ? data : JSON.parse(data);

  if (data.machine_id == machineID.machineIdSync()) {
    return;
  }

  if (data.action.toUpperCase() == "CREATE") {
    await onevent.create(data);
  }
  if (data.action.toUpperCase() == "UPDATE") {
    await onevent.update(data);
  }
  if (data.action.toUpperCase() == "DELETE") {
    await onevent.delete(data);
  }
});

try {
  app.listen(process.env.SERVER_PORT, () => {
    console.log("server running on " + process.env.SERVER_PORT);
  });
} catch (error) {
  console.log(`Port ${process.env.SERVER_PORT} is already in use`);
}
