const ondemand = require("../helpers/syncers/ondemand");
const accountModel = require("../models/account");
const watcher = require("../helpers/watcher");

// Logger
const { logger } = require("../helpers/logger");

// Upload a file to an instance
exports.upload = async (request, response) => {
  logger.info("UPLOAD START");
  // Stop watcher for a while
  // watcher.unwatchAll();

  let account = await accountModel.getOne(request.body.account_id);

  try {
    await ondemand.recursiveUpload({
      account: account,
      rootNodeId: account.document_library_node
    });

    // Start watcher now
    watcher.watchAll();
    logger.info("UPLOAD END");

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
  logger.info("DOWNLOAD START");

  let account = await accountModel.getOne(request.params.accountId);

  try {
    await ondemand.recursiveDownload({
      account: account,
      sourceNodeId: account.watch_node,
      destinationPath: account.sync_path
    });

    // Start watcher now
    watcher.watchAll();
    logger.info("DOWNLOAD END");

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
