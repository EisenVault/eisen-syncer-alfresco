const fs = require("fs");
const _ = require("lodash");
const syncer = require("../helpers/syncer");
const remote = require("../helpers/remote");
const accountModel = require("../models/account");
const watchNodeModel = require("../models/watch-node");

// Upload a file to an instance
exports.upload = async (request, response) => {
  let account = await accountModel.getOne(request.body.account_id);

  // Since its not quite possible to know if the iteration is fully completed as its not possible to know how many total items should be downloaded,
  // So a workaround is to update the last_sync_at timestamp of the account.
  // To know if the sync has completed or not, we will check the difference between current time and the last_sync_at and if its more than 20 seconds, we will consider the sync is complete
  accountModel.updateSyncTime(account.id);

  try {
    let nodes = await watchNodeModel.getNodes(account.id);

    for (let node of nodes) {
      // Recursively upload all new files to the server
      await syncer.recursiveUpload({
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

  // Since its not quite possible to know if the iteration is fully completed as its not possible to know how many total items should be downloaded,
  // So a workaround is to update the last_sync_at timestamp of the account.
  // To know if the sync has completed or not, we will check the difference between current time and the last_sync_at and if its more than 20 seconds, we will consider the sync is complete
  accountModel.updateSyncTime(account.id);

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
