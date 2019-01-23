"use strict";
const ondemand = require("../helpers/syncers/ondemand");
const { accountModel, syncStart, syncComplete } = require("../models/account");
const { watcherModel } = require("../models/watcher");
const { logger } = require("../helpers/logger");
const path = require('path');
const worker = require('../helpers/syncers/worker');

// Download nodes and its children from a remote instance
exports.download = async (request, response) => {
  logger.info("DOWNLOAD API START");

  const { dataValues: account } = await accountModel.findByPk(request.params.accountId);

  if (!account || account.sync_enabled === false) {
    logger.info("Download Bailed");
    return response
      .status(404)
      .json({ success: false, error: "Nothing to download" });
  }

  const watchFolders = await watcherModel.findAll({
    where: {
      account_id: account.id
    }
  });

  try {
    // Set the issyncing flag to on so that the client can know if the syncing progress is still going
    syncStart({
      account,
      downloadProgress: 1
    });

    for (const { dataValues: watcher } of watchFolders) {
      await ondemand.recursiveDownload({
        account,
        watcher,
        sourceNodeId: watcher.watch_node,
        destinationPath: account.sync_path
      });
    }

    // Set the sync completed time and also set issync flag to off
    syncComplete({
      account,
      downloadProgress: 0
    });

    // Start watcher now
    //fileWatcher.watchAll();
    logger.info("DOWNLOAD API END");

    return response.status(200).json({ success: true });
  } catch (error) {
    // Set the sync completed time and also set issync flag to off
    syncComplete({
      account,
      downloadProgress: 0
    });

    // Start watcher now
    //fileWatcher.watchAll();
    return response
      .status(404)
      .json({ success: false, error: "Nothing to download" });
  }
};

// Upload a file to an instance
exports.upload = async (request, response) => {
  logger.info("UPLOAD API START");
  // Stop watcher for a while
  //fileWatcher.unwatchAll();

  let accountData = await accountModel.findByPk(request.body.account_id);
  const { dataValues: account } = { ...accountData };

  if (!account || account.sync_enabled == 0) {
    logger.info("Upload Bailed");
    return response
      .status(404)
      .json({ success: false, error: "Nothing to upload" });
  }

  const watchers = await watcherModel.findAll({
    where: {
      account_id: account.id
    }
  });

  try {
    // Set the issyncing flag to on so that the client can know if the syncing progress is still going
    syncStart({
      account,
      uploadProgress: 1
    });

    for (const item of watchers) {
      const { dataValues: watcher } = item;

      // Get the folder path as /var/sync/documentLibrary or /var/sync/documentLibrary/watchedFolder
      const rootFolder = path.join(
        account.sync_path,
        watcher.watch_folder.substring(
          watcher.watch_folder.indexOf(`${watcher.site_name}/documentLibrary`)
        ),
        "/*"
      );

      await ondemand.recursiveUpload({
        account,
        watcher,
        rootFolder
      });
    }

    // Run the worker
    await worker.runUpload();

    // Set the sync completed time and also set issync flag to off
    syncComplete({
      account,
      uploadProgress: 0
    });

    // Start watcher now
    //fileWatcher.watchAll();
    logger.info("UPLOAD API END");

    return response
      .status(200)
      .json(await accountModel.findByPk(request.body.account_id, {
        attributes: { exclude: ['password'] },
      }));
  } catch (error) {
    // Set the sync completed time and also set issync flag to off
    syncComplete({
      account,
      uploadProgress: 0
    });
    // Start watcher now
    //fileWatcher.watchAll();
    return response
      .status(404)
      .json({ success: false, error: "Nothing to upload", error: error });
  }
};

