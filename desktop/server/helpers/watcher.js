const watch = require("watch");
const fs = require("fs");
const syncer = require("../helpers/syncers/ondemand");
const { accountModel } = require("../models/account");
const remote = require("./remote");
// Logger
const { logger } = require('./logger');

// Add a new watcher
exports.watch = account => {
  let watchlist = [];

  if (!fs.existsSync(account.sync_path)) {
    return watchlist;
  }

  var uniqueFileSet = new Set();
  watch.watchTree(account.sync_path, { ignoreDotFiles: true }, function (
    f,
    curr,
    prev
  ) {

    if (typeof f === "object" && prev === null && curr === null) {
      // Finished walking the tree
    } else if (prev === null) {
      // f is a new file/folder
      setTimeout(() => {
        if (watchlist.indexOf(f) === -1) {
          let type = "file";
          if (fs.lstatSync(f).isDirectory()) {
            type = "directory";
          }
          _upload(account, f);
          logger.info(`${f} is a new ${type}`);
        }
      }, 1000);

      watchlist.push(f);

    } else if (curr.nlink === 0) {
      // f was removed
      setTimeout(() => {
        if (watchlist.indexOf(f) === -1) {
          _delete(account, f);
          logger.info(`${f} was removed`);
        }
      }, 1000);
      watchlist.push(f);

    } else {
      // f was changed
      if (watchlist.indexOf(f) === -1) {
        _upload(account, f);
        logger.info(`${f} was changed...`);
      }
      watchlist.push(f);
    }
  });

  setInterval(() => {
    watchlist = [];
  }, 1500);
};

// remove a watchlist
exports.unwatchAll = async () => {
  let accounts = await accountModel.getAll();
  logger.info("Watcher paused");

  // Remove all watchers
  for (let account of accounts) {
    watch.unwatchTree(account.sync_path);
  }
};

exports.watchAll = async () => {

  // Disabling the file watcher since the watch module is trigerring multuple change events.
  return;
  let accounts = await accountModel.getAll();

  // Remove all watchers first
  // await this.unwatchAll();

  logger.info("Watcher started");

  // Add new watchers
  accounts = await accountModel.getAll(1);
  for (let account of accounts) {
    this.watch(account);
  }
};

async function _upload(account, syncPath) {
  if (fs.statSync(syncPath).isFile()) {
    // If syncPath is a file, just upload it and bail out! 
    return remote.upload({
      account,
      filePath: syncPath,
      rootNodeId: account.watch_node
    });
  } else {
    await syncer.recursiveUpload({
      account: account,
      sync_path: syncPath,
      rootNodeId: account.watch_node
    });
  }
}

async function _delete(account, filePath) {
  await syncer.deleteByPath({
    account: account,
    filePath: filePath
  });
}
