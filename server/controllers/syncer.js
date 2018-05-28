const fs = require("fs");
const _ = require("lodash");
const syncer = require("../helpers/syncer");
const remote = require("../helpers/remote");
const accountModel = require("../models/account");
const watchNodeModel = require("../models/watch-node");

// Upload a file to an instance
exports.upload = async (request, response) => {
  let account = await accountModel.getOne(request.body.account_id);

  try {
    let nodes = await watchNodeModel.getNodes(account);

    for (let node of nodes) {
      // Recursively upload all new files to the server
      await syncer.recursiveUpload({
        account: account,
        rootNodeId: node.node_id,
        overwrite: account.overwrite || 0
      });
    }

    return response.status(200).json({ success: true });
  } catch (error) {
    return response
      .status(404)
      .json({ success: false, error: "Nothing to upload", error: error });
  }
};

// Download nodes and its children from a remote instance
exports.download = async (request, response) => {
  let account = await accountModel.getOneWithPassword(request.query.account_id);
  let nodes = await watchNodeModel.getNodes(account.id);

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
