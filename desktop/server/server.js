const express = require("express");
const path = require("path");
const Sequelize = require("sequelize");
const bodyParser = require("body-parser");
const cors = require("cors");
const io = require("socket.io-client");
const watcher = require("./helpers/watcher");
const { accountModel } = require("./models/account");
const { watcherModel } = require("./models/watcher");
const { add: errorLogAdd } = require("./models/log-error");
const _ = require("lodash");
const env = require("./config/env");
const _path = require("./helpers/path");
const _base = require("./helpers/syncers/_base");
const onevent = require("./helpers/syncers/onevent");
const worker = require("./helpers/syncers/worker");
var bugsnag = require("@bugsnag/js");
bugsnag({
  apiKey: env.BUGSNAG_KEY,
  onUncaughtException: function(error, report) {
    errorLogAdd(0, error, `${__filename}/server.js`);
    logger.error(`An onUncaughtException has occurred : ${error}`);

    // Exit if another instance is running
    if (error.message.includes("EADDRINUSE")) {
      process.exit(0);
    }
  },
  onUnhandledRejection: function(error, report) {
    errorLogAdd(0, error, `${__filename}/server.js`);
    logger.error(`An onUnhandledRejection has occurred : ${error}`);
  }
});

const app = express();

// Logger
const { logger } = require("./helpers/logger");

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
app.use("/watchers", require("./routes/watcher"));

// Set the timezone in the process env
process.env.TZ = "Etc/Greenwich";
process.env.UV_THREADPOOL_SIZE = 128;

(() => {
  accountModel
    .findAll({
      where: {
        sync_enabled: 1
      }
    })
    .then(async accounts => {
      // For every account, set the sync progress to compeleted
      for (const { dataValues: account } of accounts) {
        if (account && account.id) {
          await accountModel.update(
            {
              sync_in_progress: 0,
              download_in_progress: 0,
              upload_in_progress: 0,
              last_synced_at: Math.round(new Date().getTime())
            },
            {
              where: {
                id: account.id
              }
            }
          );
        }
      }
    })
    .catch(error => console.log(error));
  return;
})();

// Start watching all the sync_paths
watcher.watchAll();

// Run the worker
worker.runUpload(false);

// Listen to event notifications from the socket service
let socket = io.connect(env.SERVICE_URL);

socket.on("sync-notification", async data => {
  const socketData = typeof data === "object" ? data : JSON.parse(data);

  if (!socketData.path && !socketData.node_id) {
    // The response should have atleast the path or the node_id
    return;
  }

  const action = socketData.action.toUpperCase();

  // Get all accounts by instances
  const accountData = await accountModel.findAll({
    where: {
      instance_url: _base.getInstanceUrl(socketData.instance_url),
      sync_enabled: true
    }
  });

  if (_.isEmpty(accountData)) {
    return;
  }

  for (const accountItem of accountData) {
    const { dataValues: account } = { ...accountItem };

    // Since the delete action does not contain path, we will handle it in a diff way
    if (action === "DELETE") {
      await onevent.delete({
        account,
        node_id: socketData.node_id
      });
      continue;
    }

    // Convert the nodepath to a localpath
    const localPath = _path.getLocalPathFromNodePath({
      account,
      nodePath: socketData.path
    });

    // Get the sitename from the localpath
    const siteName = _path.getSiteNameFromPath(localPath);

    // For each account, fetch the watcher so that the syncer would only consider syncing the files that are being watched
    const watchers = await watcherModel.findAll({
      where: {
        account_id: account.id,
        site_name: siteName,
        site_id: socketData.site_uuid
      },
      order: [[Sequelize.fn("length", Sequelize.col("watch_folder")), "DESC"]]
    });

    let watcherData;
    let socketComparePath = socketData.path;
    if (socketData.is_file === true) {
      socketComparePath = path.dirname(socketData.path);
    }
    for (const iterator of watchers) {
      if (`${socketComparePath}/`.includes(`${iterator.watch_folder}/`)) {
        watcherData = iterator;
        break;
      }
    }

    if (action === "MOVE") {
      await onevent.move({
        account,
        watcherData,
        socketData,
        localPath
      });
    }

    // Looks like the path is not being watched
    if (typeof watcherData === "undefined") {
      continue;
    }

    if (action === "CREATE") {
      await onevent.create({
        account,
        watcherData,
        socketData,
        localPath
      });
    }

    if (action === "UPDATE") {
      await onevent.update({
        account,
        watcherData,
        socketData,
        localPath
      });
    }
  }
});

app.listen(env.SERVER_PORT, () => {
  logger.info(`server running on: ${env.SERVER_PORT}`);
});
