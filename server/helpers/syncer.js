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
  let serverFileList = [];

  try {
    // Stop watcher for a while
    watcher.unwatchAll();

    // Get all the child items of the given nodeid
    let childrens = await remote.getChildren({
      account: account,
      parentNodeId: sourceNodeId
    });

    let counter = 0;
    for (const child of childrens.list.entries) {
      counter++;
      let currentDirectory = path.join(destinationPath, child.entry.name);
      let sourceNodeId = child.entry.id;

      // Add each server file/directory in the global container so that we can later compare which one needs to be deleted on local.
      serverFileList.push(currentDirectory);

      let record = await nodeModel.getOneByNodeId({
        account: account,
        nodeId: sourceNodeId
      });

      // Case 1: Check If the remote node is not present on local
      if (!fs.existsSync(currentDirectory)) {
        // Case 1.1 Check File refrence is present in DB (perhaps file was renamed on server).
        if (record) {
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
        let nodeModifiedDate = Math.round(
          Date.parse(String(child.entry.modifiedAt)) / 1000
        );
        let fileModifiedDate = record.file_update_at;

        // Check if server file modified date is Greater than local node, then download node (server node is newer version)
        if (nodeModifiedDate > fileModifiedDate) {
          await _createItemOnLocal({
            child: child,
            currentDirectory: currentDirectory,
            account: account,
            sourceNodeId: sourceNodeId
          });
        } else if (nodeModifiedDate < fileModifiedDate) {
          // Check if server file modified date is Less than the local node, then upload the node from local to server (since server node is old version)
          this.recursiveUpload({
            account: account,
            syncPath: currentDirectory,
            overwrite: true,
            rootNodeId: sourceNodeId
          });
        }
      }
    }

    // Start watcher now
    watcher.watchAll();
  } catch (error) {
    errorLogModel.add(account.id, error);
    // Set the sync completed time and also set issync flag to off
    accountModel.syncComplete(account.id);
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
    // If the main folder is a directory, prepend its path to the list so that the main folder is also added in the "nodes" folder
    if (params.sync_path && fs.statSync(params.sync_path).isDirectory()) {
      localFilePathList.unshift(params.sync_path);
    }

    let counter = 0;
    // Iterate through each file and perform certain task
    for (let filePath of localFilePathList) {
      counter++;
      // Get the DB record of the filePath
      let recordExists = await nodeModel.getOneByFilePath({
        account: account,
        filePath: filePath
      });

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
      // console.log('CONDITION', recordExists && recordExists.file_update_at != fileModifiedTime );
      console.log(filePath);

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
      this.recursiveDelete({
        account: account
      });
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
    remote.deleteServerNode({
      account: account,
      deletedNodeId: record.node_id
    });
  }
};

// This function will recursively delete all files/folders from a path. It even deletes an empty folder.
_deleteFolderRecursive = function(path) {
  var files = [];
  if (fs.existsSync(path)) {
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

    await this.recursiveDownload({
      account: account,
      sourceNodeId: sourceNodeId,
      destinationPath: currentDirectory
    });
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
    return Date.parse(String(fileStat.mtime)) / 1000;
  }
  return 0;
};
