const watch = require("watch");
const fs = require("fs");
const _ = require("lodash");
const syncer = require("../helpers/syncer");
const remote = require("../helpers/remote");
const accountModel = require("../models/account");
const watchFolderModel = require("../models/watch-folder");

// Upload a file to an instance
exports.upload = async (request, response) => {
  let account = await accountModel.getOne(request.body.account_id);

  try {
    let nodes = await watchFolderModel.getNodes(account);

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
  let account = await accountModel.getOne(request.query.account_id);
  let nodes = await watchFolderModel.getNodes(account);

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
