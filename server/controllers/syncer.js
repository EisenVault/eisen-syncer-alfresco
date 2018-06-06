const fs = require("fs");
const _ = require("lodash");
const syncer = require("../helpers/syncer");
const remote = require("../helpers/remote");
const accountModel = require("../models/account");

// Upload a file to an instance
exports.upload = async (request, response) => {
  let account = await accountModel.getOne(request.body.account_id);

  try {
    await syncer.recursiveUpload({
      account: account,
      rootNodeId: accountModel.watch_node
    });

    return response
      .status(200)
      .json(await accountModel.getOne(request.body.account_id));
  } catch (error) {
    return response
      .status(404)
      .json({ success: false, error: "Nothing to upload", error: error });
  }
};

// Download nodes and its children from a remote instance
exports.download = async (request, response) => {
  let account = await accountModel.getOne(request.params.accountId);

  try {
    await syncer.recursiveDownload({
      account: account,
      sourceNodeId: account.watch_node,
      destinationPath: account.sync_path
    });

    return response.status(200).json({ success: true });
  } catch (error) {
    return response
      .status(404)
      .json({ success: false, error: "Nothing to download" });
  }
};

// Delete records from DB for files that do not exists on local
exports.delete = async (request, response) => {
  let account = await accountModel.getOne(request.params.accountId);

  try {
    await syncer.recursiveDelete({
      account: account
    });

    return response
      .status(200)
      .json(await accountModel.getOne(request.body.account_id));
  } catch (error) {
    return response
      .status(404)
      .json({ success: false, error: "Nothing to upload", error: error });
  }
};
