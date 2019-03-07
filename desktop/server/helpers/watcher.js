const fs = require("fs");
const path = require("path");
const { accountModel, syncStart, syncComplete } = require("../models/account");
const { nodeModel } = require("../models/node");
const { workerModel } = require("../models/worker");
const { watcherModel } = require("../models/watcher");
const { add: errorLogAdd } = require("../models/log-error");
const remote = require("./remote");
const worker = require('../helpers/syncers/worker');
const _path = require('./path');
const _base = require('./syncers/_base');
const _ = require('lodash');
const chokidar = require('chokidar');

// Logger
const { logger } = require('./logger');

let watcher = null;

try {
  watcher = chokidar.watch('__test', {
    ignored: /(^|[\/\\])\../,
    ignoreInitial: true,
    ignorePermissionErrors: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
    }
  });
} catch (error) {
  errorLogAdd(0, error, `${__filename}/chokidar`);
  return;
}

exports.closeAll = async () => {
  logger.info("Watcher Closed");
  try {
    watcher.close();
  } catch (error) { }
}

exports.watchAll = async () => {
  // Remove all watchers first
  exports.closeAll();
  logger.info("Watcher started");

  // Add new watchers
  accounts = await accountModel.findAll({
    where: {
      sync_enabled: true
    }
  });

  if (accounts) {
    const accountSet = new Set();

    for (let { dataValues: account } of accounts) {
      if (!fs.existsSync(account.sync_path)) {
        return;
      }

      try {
        watcher
          .add(account.sync_path);
        accountSet.add(account);
      } catch (error) {
        return;
      }
    }

    // Listen to the events
    watcher
      .on('all', async (event, path) => {
        path = _path.toUnix(path);
        accountSet.forEach(async accountItem => {
          if (path.indexOf(accountItem.sync_path + '/') !== -1) {
            switch (event) {
              case 'add':
              case 'addDir':
                logger.info(`${event} - ${path}`);
                await _upload(accountItem, path);
                break;
              case 'change':
                logger.info(`${event} - ${path}`);
                await _upload(accountItem, path);
                break;
              case 'unlink':
              case 'unlinkDir':
                logger.info(`${event} - ${path}`);
                await _delete(accountItem, path);
                break;
            }
          }
        });
      });
  }
};

async function _upload(account, filePath) {

  filePath = _path.toUnix(filePath);

  // Set Sync in progress
  await syncStart({
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

    const siteName = _path.getSiteNameFromPath(filePath);

    if (watcher.site_name !== siteName || path.basename(filePath) == 'documentLibrary') {
      continue;
    }

    // If the node's file_update_at is same as file's updated timestamp 
    // OR if download_in_progress is true, bail out (since the file was just downloaded or is still downloading)
    const nodeRecord = await nodeModel.findOne({
      where: {
        account_id: account.id,
        site_id: watcher.site_id,
        file_path: filePath
      }
    });

    if (nodeRecord) {
      const { dataValues: node } = { ...nodeRecord };
      if (node.download_in_progress === true || node.file_update_at === _base.getFileModifiedTime(filePath)) {
        continue;
      }
    }

    try {
      // Delete any old existing record, so that we can add a priority record to simulate realtime update/add of file
      await workerModel.destroy({
        where: {
          account_id: account.id,
          watcher_id: watcher.id,
          file_path: filePath
        }
      });
    } catch (error) {
      console.log('watcher._upload', error);
      logger.info("Unable to delete worker record");
    }

    let statSync = null;
    try {
      statSync = fs.statSync(filePath);
    } catch (error) {
      errorLogAdd(account.id, error, `${__filename}/_upload`);
      return;
    }

    try {
      await workerModel.create({
        account_id: account.id,
        watcher_id: watcher.id,
        file_path: filePath,
        root_node_id: watcher.document_library_node,
        priority: statSync.isDirectory() ? 2 : 1
      });
    } catch (error) {
      // Log only if its not a unique constraint error.
      if (_.has(error, 'parent.errno') && error.parent.errno !== 19) {
        console.log('error', error);
      }
    }
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

  filePath = _path.toUnix(filePath);

  let nodeData = await nodeModel.findOne({
    where: {
      account_id: account.id,
      file_path: filePath
    }
  });

  if (nodeData) {
    let { dataValues: record } = nodeData;
    const siteName = _path.getSiteNameFromPath(record.file_path);

    const watcherData = await watcherModel.findOne({
      where: {
        account_id: account.id,
        site_name: siteName
      }
    });

    if (_.isEmpty(watcherData)) {
      return;
    }

    await remote.deleteServerNode({
      account,
      record
    });
  }
}
