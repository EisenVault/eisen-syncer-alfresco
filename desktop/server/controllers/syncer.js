"use strict";
const ondemand = require("../helpers/syncers/ondemand");
const { accountModel, syncStart, syncComplete } = require("../models/account");
const { watcherModel } = require("../models/watcher");
const { logger } = require("../helpers/logger");
const path = require("path");
const Sequelize = require("sequelize");

// Download nodes and its children from a remote instance
exports.download = async (request, response) => {

  logger.info("DOWNLOAD API START");

  const { dataValues: account } = await accountModel.findByPk(
    request.params.accountId
  );

  if (
    !account ||
    account.sync_enabled === false ||
    account.download_in_progress === true
  ) {
    logger.info("Download Bailed");
    return false;
  }

  const watchFolders = await watcherModel.findAll({
    where: {
      account_id: account.id
    }
  });

  try {
    // Set the issyncing flag to on so that the client can know if the syncing progress is still going
    await syncStart({
      account,
      downloadProgress: true
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
    await syncComplete({
      account,
      downloadProgress: false
    });

    logger.info("DOWNLOAD API END");

    return response.status(200).json({ success: true });
  } catch (error) {
    // Set the sync completed time and also set issync flag to off
    await syncComplete({
      account,
      downloadProgress: 0
    });

    return false;
  }
};

// Upload a file to an instance
exports.upload = async (request, response) => {

  logger.info("UPLOAD API START");

  let accountData = await accountModel.findByPk(request.body.account_id);
  const { dataValues: account } = { ...accountData };

  if (
    !account ||
    account.sync_enabled == 0 ||
    account.upload_in_progress === true
  ) {
    logger.info("Upload Bailed");
    return false;
  }

  const watchers = await watcherModel.findAll({
    where: {
      account_id: account.id
    }
  });

  try {
    // Set the issyncing flag to on so that the client can know if the syncing progress is still going
    await syncStart({
      account,
      uploadProgress: true
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

    // Set the sync completed time and also set issync flag to off
    await syncComplete({
      account,
      uploadProgress: false
    });

    logger.info("UPLOAD API END");

    return response.status(200).json(
      await accountModel.findByPk(request.body.account_id, {
        attributes: { exclude: ["password"] }
      })
    );
  } catch (error) {
    // Set the sync completed time and also set issync flag to off
    syncComplete({
      account,
      uploadProgress: 0
    });

    return false;
  }
};
