const fs = require("fs");
const _ = require("lodash");
const syncer = require("../helpers/syncer");
const remote = require("../helpers/remote");
const accountModel = require("../models/account");
const watchNodeModel = require("../models/watch-node");

// Upload a file to an instance
exports.upload = async (request, response) => {
  let account = await accountModel.getOne(request.body.account_id);

  // Set the sync in progress to off
  accountModel.syncComplete(account.id);

  try {
    let nodes = await watchNodeModel.getNodes(account.id);

    for (let node of nodes) {
      // Recursively walk through each directory and perform certain task
      await syncer.directoryWalk({
        account: account,
        rootNodeId: node.node_id
      });
    }

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
  let nodes = await watchNodeModel.getNodes(account.id);

  // Set the sync progress to compeleted
  accountModel.syncComplete(account.id);

  try {
    for (let node of nodes) {
      await syncer.recursiveDownload({
        account: account,
        sourceNodeId: node.node_id,
        destinationPath: account.sync_path
      });
    }

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

  // Set the sync in progress to off
  accountModel.syncComplete(account.id);

  try {
    let nodes = await watchNodeModel.getNodes(account.id);

    for (let node of nodes) {
      // Recursively walk through each directory and perform certain task
      await syncer.recursiveDelete({
        account: account
      });
    }

    return response
      .status(200)
      .json(await accountModel.getOne(request.body.account_id));
  } catch (error) {
    return response
      .status(404)
      .json({ success: false, error: "Nothing to upload", error: error });
  }
};