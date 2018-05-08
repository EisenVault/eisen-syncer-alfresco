const watch = require("watch");
const fs = require("fs");
const syncer = require("../helpers/syncer");
const remote = require("../helpers/remote");

// Upload a file to an instance
exports.upload = async (request, response) => {
  await syncer.upload({
    accountId: 10,
    sourcePath: "",
    destinationNodeId: "",
    uploadDirectory: "",
    overwrite: true
  });

  return response.status(200).json({ upload: true });
};

// Download a node from an instance
exports.download = async (request, response) => {
  // await syncer.download({
  //   destinationPath: "",
  //   sourceNodeId: ""
  // });

  let x = await remote.getChildren({
    accountId: 1,
    parentNodeId: "340f2ecd-9ed4-4990-896b-e5c109905f67"
  });

  console.log(x);

  return response.status(200).json({ download: true });
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
