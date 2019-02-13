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

exports.watchAll = async () => {
  let watcher = chokidar.watch('__test', {
    ignored: /(^|[\/\\])\../,
    ignoreInitial: true,
    ignorePermissionErrors: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
    }
  });
  // Remove all watchers first
  watcher.close();
  logger.info("Watcher started");

  // Add new watchers
  accounts = await accountModel.findAll({
    where: {
      sync_enabled: true
    }
  });

  if (accounts) {
    for (let { dataValues: account } of accounts) {

      if (!fs.existsSync(account.sync_path)) {
        return;
      }

      watcher
        .add(account.sync_path)
        .on('all', async (event, path) => {
          switch (event) {
            case 'add':
            case 'addDir':
              logger.info(`${event} - ${path}`);
              await _upload(account, path);
              break;
            case 'change':
              logger.info(`${event} - ${path}`);
              await _upload(account, path);
              break;
            case 'unlink':
            case 'unlinkDir':
              logger.info(`${event} - ${path}`);
              await _delete(account, path);
              break;
          }
        });
    }
  }
};

async function _upload(account, filePath) {
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

    try {
      const statSync = fs.statSync(filePath);
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

  //await worker.runUpload(true);

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
