const ondemand = require("../helpers/syncers/ondemand");
const accountModel = require("../models/account");
const watcher = require("../helpers/watcher");

// Upload a file to an instance
exports.upload = async (request, response) => {
  console.log("UPLOAD START");
  // Stop watcher for a while
  watcher.unwatchAll();

  let account = await accountModel.getOne(request.body.account_id);

  try {
    await ondemand.recursiveUpload({
      account: account,
      rootNodeId: account.watch_node
    });

    // Start watcher now
    watcher.watchAll();
    console.log("UPLOAD END");

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
  console.log("DOWNLOAD START");

  let account = await accountModel.getOne(request.params.accountId);

  try {
    await ondemand.recursiveDownload({
      account: account,
      sourceNodeId: account.watch_node,
      destinationPath: account.sync_path
    });

    // Start watcher now
    watcher.watchAll();
    console.log("DOWNLOAD END");

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
  let account = await accountModel.getOne(request.params.accountId);

  try {
    console.log("DELETE START");

    await ondemand.recursiveDelete({
      account: account
    });

    // Start watcher now
    watcher.watchAll();
    console.log("DELETE END");

    return response.status(200).json(account);
  } catch (error) {
    console.log("error", error);
    // Start watcher now
    watcher.watchAll();
    return response
      .status(404)
      .json({ success: false, error: error, error: error });
  }
};
