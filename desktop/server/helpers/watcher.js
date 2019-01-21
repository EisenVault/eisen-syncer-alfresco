const watch = require("watch");
const fs = require("fs");
const { accountModel, syncStart, syncComplete } = require("../models/account");
const { nodeModel } = require("../models/node");
const { workerModel } = require("../models/worker");
const { watcherModel } = require("../models/watcher");
const remote = require("./remote");
const worker = require('../helpers/syncers/worker');

// Logger
const { logger } = require('./logger');

// Add a new watcher
exports.watch = account => {
  let watchlist = [];

  if (!fs.existsSync(account.sync_path)) {
    return watchlist;
  }

  watch.watchTree(account.sync_path, { ignoreDotFiles: true }, function (
    f,
    curr,
    prev
  ) {

    if (typeof f === "object" && prev === null && curr === null) {
      // Finished walking the tree
    } else if (prev === null) {
      // f is a new file/folder
      watchlist.push(f);
      if (_countElements(f, watchlist) <= 1) {
        let type = "file";
        if (fs.lstatSync(f).isDirectory()) {
          type = "directory";
        }
        _upload(account, f);
        logger.info(`${f} is a new ${type}`);
      }


    } else if (curr.nlink === 0) {
      watchlist.push(f);
      // f was removed
      if (_countElements(f, watchlist) <= 1) {
        _delete(account, f);
        logger.info(`${f} was removed`);
      }

    } else {
      // f was changed
      watchlist.push(f);
      if (_countElements(f, watchlist) <= 1) {
        _upload(account, f);
        logger.info(`${f} was changed...`);
      }
    }
  });

  setInterval(() => {
    watchlist = [];
  }, 1500);
};

// remove a watchlist
exports.unwatchAll = async () => {
  accounts = await accountModel.findAll();
  logger.info("Watcher paused");

  // Remove all watchers
  if (accounts) {
    for (let { dataValues: account } of accounts) {
      watch.unwatchTree(account.sync_path);
    }
  }
};

exports.watchAll = async () => {
  // Remove all watchers first
  await this.unwatchAll();
  logger.info("Watcher started");

  // Add new watchers
  accounts = await accountModel.findAll({
    where: {
      sync_enabled: true
    }
  });

  if (accounts) {
    for (let { dataValues: account } of accounts) {
      this.watch(account);
    }
  }
};

async function _upload(account, filePath) {
  // Set Sync in progress
  syncStart({
    account: {
      id: worker.account_id
    },
    uploadProgress: true
  });

  const watchers = await watcherModel.findAll({
    where: {
      account_id: account.id
    }
  });

  for (const item of watchers) {
    const { dataValues: watcher } = item;

    try {
      await workerModel.create({
        account_id: account.id,
        watcher_id: watcher.id,
        file_path: filePath,
        root_node_id: watcher.document_library_node,
        priority: 1
      });
    } catch (error) {
      // Log only if its not a unique constraint error.
      if (error.parent.errno !== 19) {
        console.log('error', error);
      }
    }
    await worker.runUpload(false);
  } // end for loop

  // Stop Sync in progress
  syncComplete({
    account: {
      id: worker.account_id
    },
    uploadProgress: false
  });
}

async function _delete(account, filePath) {
  let nodeData = await nodeModel.findOne({
    where: {
      file_path: filePath
    }
  });

  if (nodeData) {
    let { dataValues: record } = nodeData;
    await remote.deleteServerNode({
      account,
      record
    });
  }
}

// This function returns the count of elements present in an array
function _countElements(needle, hacksack) {
  return hacksack.reduce((counter, value) => {
    return value === needle ? ++counter : counter;
  }, 0);
}
