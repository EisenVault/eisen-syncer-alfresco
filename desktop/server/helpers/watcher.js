const watch = require("watch");
const fs = require("fs");
const { accountModel } = require("../models/account");
const { nodeModel } = require("../models/node");
const { watcherModel } = require("../models/watcher");
const remote = require("./remote");
const { getSiteNameFromPath } = require('../helpers/path');
const _base = require("./syncers/_base");

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
  return;
  let nodeData = await nodeModel.findOne({
    where: {
      file_path: filePath
    }
  });

  if (nodeData) {
    const { dataValues: node } = nodeData;
    // No need to upload a file, that was already uploaded and doesn't have any changes
    if (_base.getFileModifiedTime(filePath) <= node.last_uploaded_at) {
      return;
    }
  }

  let watcherData = await watcherModel.findOne({
    where: {
      site_name: getSiteNameFromPath(filePath)
    }
  });

  if (!watcherData) {
    return;
  }

  let { dataValues: watcher } = watcherData;
  return remote.upload({
    account,
    watcher,
    filePath,
    rootNodeId: watcher.document_library_node
  });
}

async function _delete(account, filePath) {
  return;
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
