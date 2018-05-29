const watch = require("watch");
const fs = require("fs");
const syncer = require("../helpers/syncer");
const accountModel = require("../models/account");
const watchNodeModel = require("../models/watch-node");

// Add a new watcher
exports.watch = account => {
  let watchlist = [];
  watch.watchTree(account.sync_path, function(f, curr, prev) {
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
        _upload(account);
        console.log(f + " is a new " + type);
      }

      watchlist.push(f);
    } else if (curr.nlink === 0) {
      // f was removed
      if (watchlist.indexOf(f) == -1) {
        _upload(account);
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
};

// remove a watchlist
exports.remove = path => {
  watch.unwatchTree(path);
};

exports.updateWatcher = async () => {
  let accounts = await accountModel.getAll();

  // Remove all watchers first
  for (let account of accounts) {
    this.remove(account.sync_path);
  }

  // Add new watchers
  accounts = await accountModel.getAll(1);
  for (let account of accounts) {
    this.watch(account);
  }
};


async function _upload(account) {
  let nodes = await watchNodeModel.getNodes(account.id);

  for (let node of nodes) {
    // Recursively upload all new files to the server
    await syncer.recursiveUpload({
      account: account,
      rootNodeId: node.node_id
    });
  }
}