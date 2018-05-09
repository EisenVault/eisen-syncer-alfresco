const watch = require("watch");
const fs = require("fs");
const _ = require("lodash");
const syncer = require("../helpers/syncer");
const remote = require("../helpers/remote");
const accountModel = require("../models/account");

// Upload a file to an instance
exports.upload = async (request, response) => {
  await syncer.upload({
    accountId: request.body.account_id,
    sourcePath: request.body.source_path,
    destinationNodeId: request.body.destination_node_id,
    uploadDirectory: request.body.upload_directory,
    overwrite: request.body.overwrite
  });

  return response.status(200).json({ upload: true });
};

// Download nodes and its children from a remote instance
exports.download = async (request, response) => {
  let accountId = request.query.account_id;
  let parentNodeId = request.query.parent_node_id;

  let account = await accountModel.getOne(accountId);

  try {
    await syncer.recursive({
      account: account,
      sourceNodeId: parentNodeId,
      destinationPath: account.sync_path
    });

    return response.status(200).json({ success: true });
  } catch (error) {
    return response
      .status(404)
      .json({ success: false, error: "Nothing to download" });
  }
};

// Add a new watcher
exports.add = (request, response) => {
  ///home/soubhik/Documents/watcher
  let watchlist = [];
  watch.watchTree(request.body.path, function(f, curr, prev) {
    if (typeof f == "object" && prev === null && curr === null) {
      // Finished walking the tree
      console.log("Finished walking the tree");
    } else if (prev === null) {
      // f is a new file
      if (watchlist.indexOf(f) == -1) {
        let type = "file";
        if (fs.lstatSync(f).isDirectory()) {
          type = "directory";
        }

        console.log(f + " is a new " + type);
      }

      watchlist.push(f);
    } else if (curr.nlink === 0) {
      // f was removed
      if (watchlist.indexOf(f) == -1) {
        console.log(f + " was removed");
      }
      watchlist.push(f);
    } else {
      // f was changed
      if (watchlist.indexOf(f) == -1) {
        console.log(f + " was changed");
      }
      watchlist.push(f);
    }
  });

  setInterval(() => {
    watchlist = [];
  }, 1500);

  return response.status(200).json({ a: 1 });
};

// remove a watchlist
exports.remove = (request, response) => {
  watch.unwatchTree(request.body.path);

  return response.status(200).json({ a: 1 });
};
