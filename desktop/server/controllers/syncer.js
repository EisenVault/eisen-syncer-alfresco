const ondemand = require("../helpers/syncers/ondemand");
const accountModel = require("../models/account");
const watcher = require("../helpers/watcher");
const watcherModel = require("../models/watcher");
const { logger } = require("../helpers/logger");


// Download nodes and its children from a remote instance
exports.download = async (request, response) => {
  logger.info("DOWNLOAD API START");

  const account = await accountModel.getOne(request.params.accountId);

  if (!account || account.sync_enabled == 0 || account.sync_in_progress == 1) {
    logger.info("Download Bailed");
    return;
  }

  const watchFolders = await watcherModel.getAllByAccountId(account.id);

  try {
    // Set the issyncing flag to on so that the client can know if the syncing progress is still going
    await accountModel.syncStart(account.id);

    for (const watcher of watchFolders) {
      await ondemand.recursiveDownload({
        account,
        watcher,
        sourceNodeId: watcher.watch_node,
        destinationPath: watcher.sync_path
      });
    }

    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);

    // Start watcher now
    watcher.watchAll();
    logger.info("DOWNLOAD API END");

    return response.status(200).json({ success: true });
  } catch (error) {
    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);
    // Start watcher now
    watcher.watchAll();
    return response
      .status(404)
      .json({ success: false, error: "Nothing to download" });
  }
};

// Upload a file to an instance
exports.upload = async (request, response) => {
  logger.info("UPLOAD API START");
  // Stop watcher for a while
  // watcher.unwatchAll();

  let account = await accountModel.getOne(request.body.account_id);

  if (!account || account.sync_enabled == 0 || account.sync_in_progress == 1) {
    logger.info("Upload Bailed");
    return;
  }

  const watchers = await watcherModel.getAllByAccountId(account.id);

  try {
    // Set the issyncing flag to on so that the client can know if the syncing progress is still going
    await accountModel.syncStart(account.id);

    for (const watcher of watchers) {
      await ondemand.recursiveUpload({
        account,
        watcher,
        rootNodeId: watcher.document_library_node
      });
    }

    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);

    // Start watcher now
    watcher.watchAll();
    logger.info("UPLOAD API END");

    return response
      .status(200)
      .json(await accountModel.getOne(request.body.account_id));
  } catch (error) {
    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);
    // Start watcher now
    watcher.watchAll();
    return response
      .status(404)
      .json({ success: false, error: "Nothing to upload", error: error });
  }
};

