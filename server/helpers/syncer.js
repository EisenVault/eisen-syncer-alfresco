const fs = require("fs");
const _ = require("lodash");
const path = require("path");
const crypt = require("../config/crypt");
const btoa = require("btoa");
const request = require("request-promise-native");
const accountModel = require("../models/account");
const remote = require("./remote");
const nodeModel = require("../models/node");
const glob = require("glob");
const errorLogModel = require("../models/log-error");
const eventLogModel = require("../models/log-event");
const token = require("../helpers/token");
const watcher = require("./watcher");

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  sourceNodeId: <String>,
 *  destinationPath: <String>,
 * }
 */
exports.recursiveDownload = async params => {
  let account = params.account;
  let sourceNodeId = params.sourceNodeId;
  let destinationPath = params.destinationPath;

  // Declare a container that will hold all node ids that are fetched from the server
  if (typeof this.recursiveDownload.serverFileList == "undefined") {
    this.recursiveDownload.serverFileList = [];
  }

  try {
    // Start the sync
    let sync = await accountModel.syncStart(account.id);

    // Stop watcher for a while
    watcher.unwatchAll();

    // Get all the child items of the given nodeid
    let childrens = await remote.getChildren({
      account: account,
      parentNodeId: sourceNodeId
    });

    console.log( childrens , sourceNodeId );
    
    // If no children are found, no point in proceeding further, so bailout!
    if (!childrens) {
      console.log( 'no children' );
      
      // Start watcher now
      watcher.watchAll();
      // Set the sync completed time and also set issync flag to off
      await accountModel.syncComplete(account.id);
      return;
    }

    let counter = 0;
    for (const child of childrens.list.entries) {
      // Do not continue if the sync is not enabled
      if (sync.sync_enabled == 0) {
        break;
      }

      counter++;
      let currentDirectory = path.join(destinationPath, child.entry.name);
      let sourceNodeId = child.entry.id;

      // Add each server file/directory in the global container so that we can later compare which one needs to be deleted on local.
      this.recursiveDownload.serverFileList.push(currentDirectory);

      let record = await nodeModel.getOneByNodeId({
        account: account,
        nodeId: sourceNodeId
      });

      // Case 1: Check If the remote node is NOT present on local
      if (!fs.existsSync(currentDirectory)) {
        // Case 1.1 Check File reference is present in DB (perhaps file was renamed on server).
        if (record) {
          // Delete the old file
          _deleteFolderRecursive(record.file_path);

          // Delete Old record from DB and update DB and set new filename
          await nodeModel.delete({
            account: account,
            nodeId: sourceNodeId
          });
        }

        // Case 1.1/1.2 Download the file/folder on local (this will also add the new records in the DB)
        await _createItemOnLocal({
          child: child,
          currentDirectory: currentDirectory,
          account: account,
          sourceNodeId: sourceNodeId
        });
      } else {
        // Case 2: File present in local
        if (record) {
          // Convert the time to UTC and then get the unixtimestamp.
          let nodeModifiedDate = Math.round(
            Date.parse(new Date(String(child.entry.modifiedAt)).toUTCString()) /
              1000
          );

          let fileModifiedDate = record.file_update_at;

          // Greater than local node, then download node (since server node is newer version)
          if (nodeModifiedDate > fileModifiedDate) {
            await _createItemOnLocal({
              child: child,
              currentDirectory: currentDirectory,
              account: account,
              sourceNodeId: sourceNodeId,
              isRecursive: false
            });
          }
        }
      }

      if (child.entry.isFolder === true) {
        // If a folder is found, we will get inside it and iterate through its children nodes
        await this.recursiveDownload({
          account: account,
          sourceNodeId: sourceNodeId,
          destinationPath: currentDirectory
        });
      }
    } // End forloop

    if (counter === childrens.list.entries.length) {
      console.log("Finished downloading");

      if (false) {
        // TODO: When counter reaches count of apiendpoint then execute this script
        // console.log("FINISHED....", counter);
        // console.log( _.uniq(this.recursiveDownload.serverFileList) );
      }

      // Start watcher now
      watcher.watchAll();
      // Set the sync completed time and also set issync flag to off
      await accountModel.syncComplete(account.id);
    }
  } catch (error) {
    console.log(error);

    errorLogModel.add(account.id, error);
    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);
  }
};

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  syncPath: string,
 *  overwrite: boolean,
 *  rootNodeId: string,
 * }
 */
exports.recursiveUpload = async params => {
  let account = params.account;
  let syncPath = params.sync_path || account.sync_path;
  let overwrite = account.overwrite;
  let rootNodeId = params.rootNodeId;

  rootFolder = syncPath;
  if (fs.statSync(rootFolder).isDirectory()) {
    rootFolder = syncPath + "/**/*";
  }

  // This function will list all files/folders/sub-folders recursively.
  glob(rootFolder, async (error, localFilePathList) => {
    let sync = await accountModel.syncStart(account.id);

    // If the main folder is a directory, prepend its path to the list so that the main folder is also added in the "nodes" folder
    if (params.sync_path && fs.statSync(params.sync_path).isDirectory()) {
      localFilePathList.unshift(params.sync_path);
    }

    let counter = 0;
    // Iterate through each file and perform certain task
    for (let filePath of localFilePathList) {
      // Do not continue if the sync is not enabled
      if (sync.sync_enabled == 0) {
        break;
      }

      counter++;
      // Get the DB record of the filePath
      let recordExists = await nodeModel.getOneByFilePath({
        account: account,
        filePath: filePath
      });

      console.log("filePath", filePath, rootNodeId);

      // CASE 1: Check if file is available on disk but missing in DB (New node was created).
      // Then Upload the Node to the server and once response received add a record of the same in the "nodes" table.
      if (!recordExists) {
        await remote.upload({
          account: account,
          filePath: filePath,
          rootNodeId: rootNodeId,
          overwrite: overwrite
        });
        continue;
      }

      // CASE 2: Check if file is available on disk but its modified date does not match the one in DB (file was locally updated/modified)
      // Upload the file to the server with "overwrite" flag set to true and once response received update the "file_modified_at" field in the "nodes" table.
      fileModifiedTime = this.getFileModifiedTime(filePath);

      if (recordExists && recordExists.file_update_at != fileModifiedTime) {
        await remote.upload({
          account: account,
          filePath: filePath,
          rootNodeId: rootNodeId,
          overwrite: true
        });
        continue;
      }
    } // Filelist iteration end

    // TODO CASE 3: Check if file is present in DB but missing on local disk (file was deleted on local)
    // Delete node from server and once response received, delete record from DB.
    if (counter === localFilePathList.length) {
      await this.recursiveDelete({
        account: account
      });
      // Set the sync completed time and also set issync flag to off
      await accountModel.syncComplete(account.id);
    }
  });
};

/**
 * @param object params
 * {
 *  account: Account<Object>,
 * }
 */
exports.recursiveDelete = async params => {
  let account = params.account;

  // This function will list all files/folders/sub-folders recursively.
  glob(account.sync_path + "/**/*", async (error, localFilePathList) => {
    let missingFiles = await nodeModel.getMissingFiles({
      account: account,
      fileList: localFilePathList
    });

    console.log("missing files", missingFiles);

    for (const missingFilePath of missingFiles) {
      await this.deleteByPath({
        account: account,
        filePath: missingFilePath
      });
    }
  });
};

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  filePath: string,
 * }
 */
exports.deleteByPath = async params => {
  let account = params.account;
  let filePath = params.filePath;

  let records = await nodeModel.getAllByFileOrFolderPath({
    account: account,
    path: filePath
  });

  for (let record of records) {
    // Delete the node from the server, once thats done it will delete the record from the DB as well
    await remote.deleteServerNode({
      account: account,
      deletedNodeId: record.node_id
    });
  }
};

// This function will recursively delete all files/folders from a path. It even deletes an empty folder.
_deleteFolderRecursive = function(path) {
  var files = [];
  if (fs.existsSync(path)) {
    // If file, just delete it
    if (fs.lstatSync(path).isFile()) {
      return fs.unlinkSync(path);
    }

    files = fs.readdirSync(path);
    files.forEach(function(file, index) {
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        _deleteFolderRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

_createItemOnLocal = async params => {
  let account = params.account;
  let child = params.child;
  let currentDirectory = params.currentDirectory;
  let sourceNodeId = params.sourceNodeId;
  let isRecursive = params.isRecursive || true;

  if (child.entry.isFolder == true) {
    // If the child is a folder, create the folder first
    if (!fs.existsSync(currentDirectory)) {
      fs.mkdirSync(currentDirectory);
    }

    // Add refrence to the nodes table
    await nodeModel.add({
      account: account,
      nodeId: sourceNodeId,
      filePath: currentDirectory,
      fileUpdateAt: this.getFileModifiedTime(currentDirectory),
      isFolder: true,
      isFile: false
    });

    if (isRecursive) {
      await this.recursiveDownload({
        account: account,
        sourceNodeId: sourceNodeId,
        destinationPath: currentDirectory
      });
    }
  } else if (child.entry.isFile == true) {
    // If the child is a file, download it
    await remote.download({
      account: account,
      sourceNodeId: sourceNodeId,
      destinationPath: currentDirectory
    });
  }
};

/**
 *
 * @param object filePath
 * {
 *  filePath: <String>
 * }
 */
exports.getFileModifiedTime = function(filePath) {
  if (fs.existsSync(filePath)) {
    let fileStat = fs.statSync(filePath);
    return Math.round(
      Date.parse(new Date(String(fileStat.mtime)).toUTCString()) / 1000
    );
  }
  return 0;
};
