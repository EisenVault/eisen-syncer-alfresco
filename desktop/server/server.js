const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const io = require("socket.io-client");
const watcher = require("./helpers/watcher");
const onevent = require("./helpers/syncers/onevent");
const accountModel = require("./models/account");
const nodeModel = require("./models/node");
const env = require("./config/env");
var bugsnag = require("bugsnag");
bugsnag.register(env.BUGSNAG_KEY);
const app = express();

// Loggers
const errorLog = require('./helpers/logger').errorlog;
const successlog = require('./helpers/logger').successlog;

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

  if (!data.path && !data.node_id) {
    // The response should have atleast the path or the node_id
    return;
  }

  logger.log("data", data);

  if (data.action.toUpperCase() == "DELETE") {
    // Since we are not gettting the deleted path from the socket service, we will have to look up in the nodes table to get the remote paths, and their account ids
    var nodeRemotePaths = [];
    var accounts = [];
    const deletionNodes = await nodeModel.getAllByNodeId(data.node_id);
    for (const iterator of deletionNodes) {
      nodeRemotePaths.push(iterator.remote_folder_path);
      accounts.push(iterator.account_id);
    }

    // Once we get the account ids, we will find all related accounts
    getBroadcastedAccounts = await accountModel.findByInstanceAccounts(
      data.instance_url,
      accounts
    );
  } else {
    let siteName = data.path.split("/")[3];
    getBroadcastedAccounts = await accountModel.findByInstanceSiteName(
      data.instance_url,
      siteName
    );
  }

  if (getBroadcastedAccounts.length === 0) {
    return;
  }

  for (const account of getBroadcastedAccounts) {
    if (data.action.toUpperCase() == "DELETE") {
      // Perform checks so that the action may be taken only for the folders being watched...
      for (const remotePath of nodeRemotePaths) {
        // If the deleted path on the server is inside the watch_folder of the account, then we delete the local file only under that path...
        if (remotePath.indexOf(account.watch_folder) !== -1) {
          await onevent.delete(account, data);
        }
      }
    }

    if (data.action.toUpperCase() == "CREATE") {
      // If the current path is not the watch folder of this account, then skip and go to next iteration.
      if (data.path.indexOf(account.watch_folder) === -1) {
        continue;
      }
      await onevent.create(account, data);
    }

    if (
      data.action.toUpperCase() === "UPDATE" ||
      data.action.toUpperCase() === "MOVE"
    ) {
      await onevent.update(account, data);
    }
  }
});

process.on("uncaughtException", function (error) {
  errorLog.error(`Error Message : ${error}`);
  process.exit(1);
});

app.listen(env.SERVER_PORT, () => {
  successlog.info(`server running on: ${env.SERVER_PORT}`);
});