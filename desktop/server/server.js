const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const io = require("socket.io-client");
const watcher = require("./helpers/watcher");
const onevent = require("./helpers/syncers/onevent");
const accountModel = require("./models/account");
const env = require("./config/env");
var bugsnag = require("bugsnag");
bugsnag.register(env.BUGSNAG_KEY);
const app = express();

// Middlewares
app.use(bugsnag.errorHandler);
app.use(bugsnag.requestHandler);
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
let socket = io.connect(env.SERVICE_URL);

socket.on("sync-notification", async data => {
  data = typeof data === "object" ? data : JSON.parse(data);

  if (!data.path) {
    return;
  }

  let siteName = data.path.split('/')[3];
  let getBroadcastedInstance = await accountModel.findByEnabledSyncInstance(data.instance_url, siteName);

  // If broadcast instance url is not available in the accounts table, bailout!
  if (!data || !getBroadcastedInstance || data.instance_url !== getBroadcastedInstance.instance_url) {
    return;
  }

  if (data.action.toUpperCase() == "CREATE") {
    await onevent.create(getBroadcastedInstance, data);
  }
  if (data.action.toUpperCase() == "UPDATE" || data.action.toUpperCase() == "MOVE") {
    await onevent.update(getBroadcastedInstance, data);
  }
  if (data.action.toUpperCase() == "DELETE") {
    await onevent.delete(getBroadcastedInstance, data);
  }
});

try {
  app.listen(env.SERVER_PORT, () => {
    console.log("server running on " + env.SERVER_PORT);
  });
} catch (error) {
  console.log(`Port ${env.SERVER_PORT} is already in use`);
}
