const ondemand = require("../helpers/syncers/ondemand");
const accountModel = require("../models/account");
const watcher = require("../helpers/watcher");
const watcherModel = require("../models/watcher");

// Logger
const { logger } = require("../helpers/logger");

// Upload a file to an instance
exports.upload = async (request, response) => {
  logger.info("UPLOAD API START");
  // Stop watcher for a while
  // watcher.unwatchAll();

  let account = await accountModel.getOne(request.body.account_id);
  const watchers = await watcherModel.getAllByAccountId(account.id);

  try {
    // Set the issyncing flag to on so that the client can know if the syncing progress is still going
    await accountModel.syncStart(account.id);

    for (const watcher of watchers) {
      await ondemand.recursiveUpload({
        account: account,
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
    // Start watcher now
    watcher.watchAll();
    return response
      .status(404)
      .json({ success: false, error: "Nothing to upload", error: error });
  }
};

// Download nodes and its children from a remote instance
exports.download = async (request, response) => {
  logger.info("DOWNLOAD API START");

  const account = await accountModel.getOne(request.params.accountId);
  const watchFolders = await watcherModel.getAllByAccountId(account.id);

  try {
    // Set the issyncing flag to on so that the client can know if the syncing progress is still going
    await accountModel.syncStart(account.id);
    for (const watcher of watchFolders) {
      await ondemand.recursiveDownload({
        account: account,
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
    // Start watcher now
    watcher.watchAll();
    return response
      .status(404)
      .json({ success: false, error: "Nothing to download" });
  }
};

// Delete records from DB for files that do not exists on local
exports.delete = async (request, response) => {
  return;
  let account = await accountModel.getOne(request.params.accountId);

  try {
    logger.info("DELETE START...");

    await ondemand.recursiveDelete({
      account: account
    });

    // Start watcher now
    watcher.watchAll();
    logger.info("DELETE END");

    return response.status(200).json(account);
  } catch (error) {
    logger.error("error while deleting file " + JSON.stringify(error));
    // Start watcher now
    watcher.watchAll();
    return response
      .status(404)
      .json({ success: false, error: error, error: error });
  }
};
