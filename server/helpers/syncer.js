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
    // Get all the child items of the given nodeid
    let childrens = await remote.getChildren({
      account: account,
      parentNodeId: sourceNodeId
    });

    for (const child of childrens.list.entries) {
      let currentDirectory = path.join(destinationPath, child.entry.name);
      let sourceNodeId = child.entry.id;

      console.log(currentDirectory, sourceNodeId);

      // Add each server file/directory in the global container so that we can later compare which one needs to be deleted on local.
      serverFileList.push(currentDirectory);

      // Case 1: Check If the remote node is not present on local
      if (!fs.existsSync(currentDirectory)) {
        // Case 1.1 Check File refrence is present in DB (perhaps file was renamed on server).
        let record = nodeModel.getOneByNodeId({
          account: account,
          nodeId: child.entry.id
        });

        if (record) {
          // Delete Old record from DB and update DB and set new filename
          await nodeModel.delete({
            account: account,
            nodeId: sourceNodeId
          });
        }
        // create the file/folder on local (this will also add the new records in the DB)
        await _createItemOnLocal({
          child: child,
          currentDirectory: currentDirectory,
          account: account,
          sourceNodeId: sourceNodeId
        });
      } else {
        // Case 2: File present in local
        
        

      }

      if (child.entry.isFolder == true) {
        // If the child is a folder, create the folder first
        if (!fs.existsSync(destinationPath + "/" + child.entry.name)) {
          fs.mkdirSync(currentDirectory);
        }

        this.recursiveDownload({
          account: account,
          sourceNodeId: sourceNodeId,
          destinationPath: currentDirectory
        });
      } else if (child.entry.isFile == true) {
        // If its a file, check if the file already exists in the DB, if not then download it in the current directory
        // if (_.isEmpty(recordExists)) {
        await _download({
          account: account,
          sourceNodeId: sourceNodeId,
          destinationPath: currentDirectory
        });
        // }
      }
    }
  } catch (error) {
    errorLogModel.add(account.id, error);
    console.log("ERROR OCCURRED: ", error);
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
    if (fs.statSync(syncPath).isDirectory()) {
      localFilePathList.unshift(syncPath);
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
        await _upload({
          account: account,
          filePath: filePath,
          rootNodeId: rootNodeId,
          overwrite: overwrite
        });
      }

      // CASE 2: Check if file is available on disk but its modified date does not match the one in DB (file was locally updated/modified)
      // Upload the file to the server with "overwrite" flag set to true and once response received update the "file_modified_at" field in the "nodes" table.
      fileModifiedTime = _getFileModifiedTime(filePath);
      if (recordExists && recordExists.file_update_at != fileModifiedTime) {
        await _upload({
          account: account,
          filePath: filePath,
          rootNodeId: rootNodeId,
          overwrite: true
        });
      }
    } // Filelist iteration end

    if (counter >= localFilePathList.length) {
      console.log("FOREACH LOOP COMPLETED");
    }

    console.log("FOREACH running");

    // TODO CASE 3: Check if file is present in DB but missing on local disk (file was deleted on local)
    // Delete node from server and once response received, delete record from DB.
    // await this.deleteMissingFiles({
    //   account: account,
    //   fileList: localFilePathList
    // });
  });
};

/**
 * @param object params
 * {
 *  account: Account<Object>,
 *  syncPath: string,
 *  overwrite: boolean,
 *  rootNodeId: string,
 * }
 */
exports.recursiveDelete = async params => {
  let account = params.account;
  let rootFolder = account.sync_path;

  // This function will list all files/folders/sub-folders recursively.
  glob(rootFolder + "/**/*", async (error, localFilePathList) => {
    // If the main folder is a directory, prepend its path to the list so that the main folder is also added in the "nodes" folder
    if (fs.statSync(rootFolder).isDirectory()) {
      localFilePathList.unshift(rootFolder);
    }

    // TODO CASE 3: Check if file is present in DB but missing on local disk (file was deleted on local)
    // Delete node from server and once response received, delete record from DB.
    let missingFiles = await nodeModel.getMissingFiles({
      account: account,
      fileList: localFilePathList
    });

    for (let file of missingFiles) {
      this.deleteByPath({
        account: account,
        filePath: file
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
    _deleteServerNode({
      account: account,
      deletedNodeId: record.node_id
    });
  }
};

/**
 *
 * @param object params
 * {
 *  account: <Object>,
 *  filePath: <String>,
 *  rootNodeId: <String>,
 *  uploadDirectory: <String>,
 *  overwrite: <Boolean>
 * }
 */
_upload = async params => {
  let account = params.account;
  let filePath = params.filePath;
  let rootNodeId = params.rootNodeId;
  let overwrite = String(params.overwrite);
  let options = {};

  if (!account) {
    throw new Error("Account not found");
  }

  // If its a directory, send a request to create the directory.
  if (fs.statSync(filePath).isDirectory()) {
    let directoryName = path.basename(params.filePath);
    let relativePath = params.filePath.replace(account.sync_path + "/", "");
    relativePath = relativePath.substring(
      0,
      relativePath.length - directoryName.length - 1
    );

    options = {
      resolveWithFullResponse: true,
      method: "POST",
      url:
        account.instance_url +
        "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
        rootNodeId +
        "/children",
      headers: {
        "content-type": "application/json",
        Authorization: "Basic " + (await token.get(account))
      },
      body: JSON.stringify({
        name: directoryName,
        nodeType: "cm:folder",
        relativePath: relativePath
      })
    };

    try {
      // Set the issyncing flag to on so that the client can know if the syncing progress is still going
      accountModel.syncStart(account.id);

      let response = await request(options);
      response = JSON.parse(response.body);

      if (response.entry.id) {
        // Set the sync completed time and also set issync flag to off
        accountModel.syncComplete(account.id);
        console.log("Uploaded Folder", params.filePath);

        // Add a record in the db
        await nodeModel.add({
          account: account,
          nodeId: response.entry.id,
          filePath: params.filePath,
          fileUpdateAt: _getFileModifiedTime(params.filePath),
          isFolder: true,
          isFile: false
        });

        // Add an event log
        eventLogModel.add(
          account.id,
          "UPLOAD_FOLDER",
          `Uploaded Folder: ${filePath} to ${account.instance_url}`
        );
        return response.entry.id;
      }
    } catch (error) {
      if (error.statusCode != 409) {
        // Add an error log
        errorLogModel.add(account.id, error);
      }

      // Set the sync completed time and also set issync flag to off
      accountModel.syncComplete(account.id);
    }

    return false;
  }

  // If its a file, send a request to upload the file.
  if (fs.statSync(filePath).isFile()) {
    let uploadDirectory = path.dirname(filePath);
    uploadDirectory = uploadDirectory
      .replace(account.sync_path, "")
      .substring(1);

    options = {
      resolveWithFullResponse: true,
      method: "POST",
      url: account.instance_url + "/alfresco/service/api/upload",
      headers: {
        Authorization: "Basic " + (await token.get(account))
      },
      formData: {
        filedata: {
          value: fs.createReadStream(filePath),
          options: {}
        },
        filename: path.basename(filePath),
        destination: "workspace://SpacesStore/" + rootNodeId,
        uploadDirectory: uploadDirectory,
        overwrite: overwrite
      }
    };

    try {
      // Set the issyncing flag to on so that the client can know if the syncing progress is still going
      accountModel.syncStart(account.id);
      let response = await request(options);

      response = JSON.parse(response.body);
      let refId = response.nodeRef.split("workspace://SpacesStore/");

      if (refId[1]) {
        // Set the sync completed time and also set issync flag to off
        accountModel.syncComplete(account.id);
        console.log("Uploaded File", params.filePath);

        // Add a record in the db
        await nodeModel.add({
          account: account,
          nodeId: refId[1],
          filePath: params.filePath,
          fileUpdateAt: _getFileModifiedTime(params.filePath),
          isFolder: false,
          isFile: true
        });

        // Add an event log
        eventLogModel.add(
          account.id,
          "UPLOAD_FILE",
          `Uploaded File: ${filePath} to ${account.instance_url}`
        );
        return refId[1];
      }

      return false;
    } catch (error) {
      errorLogModel.add(account.id, error);
      // Set the sync completed time and also set issync flag to off
      accountModel.syncComplete(account.id);
    }
  }

  return false;
};

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  sourceNodeId: <String>,
 *  destinationPath: <String>,
 * }
 */
_download = async params => {
  let account = params.account;
  let sourceNodeId = params.sourceNodeId;
  let destinationPath = params.destinationPath;

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      sourceNodeId +
      "/content?attachment=true",
    headers: {
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    // Set the issyncing flag to on so that the client can know if the syncing progress is still going
    accountModel.syncStart(account.id);

    console.log("Downloading", destinationPath);

    let response = await request(options).pipe(
      fs.createWriteStream(destinationPath)
    );

    fs.watchFile(destinationPath, function() {
      fs.stat(destinationPath, function(err, stats) {
        // Set the sync completed time and also set issync flag to off
        accountModel.syncComplete(account.id);
      });
    });

    // Add refrence to the nodes table
    nodeModel.add({
      account: account,
      nodeId: sourceNodeId,
      filePath: destinationPath,
      fileUpdateAt: _getFileModifiedTime(destinationPath),
      isFolder: false,
      isFile: true
    });

    // Add an event log
    eventLogModel.add(
      account.id,
      "DOWNLOAD_FILE",
      `Downloading File: ${destinationPath} from ${account.instance_url}`
    );
    return params;
  } catch (error) {
    errorLogModel.add(account.id, error);
    // Set the sync completed time and also set issync flag to off
    accountModel.syncComplete(account.id);
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
    fs.mkdirSync(currentDirectory);

    // Add refrence to the nodes table
    nodeModel.add({
      account: account,
      nodeId: sourceNodeId,
      filePath: currentDirectory,
      fileUpdateAt: _getFileModifiedTime(currentDirectory),
      isFolder: true,
      isFile: false
    });
  } else if (child.entry.isFile == true) {
    // If the child is a file, download it
    await _download({
      account: account,
      sourceNodeId: sourceNodeId,
      destinationPath: currentDirectory
    });
  }
};

/**
 * @param object params
 * {
 *  account: <Object>,
 *  deletedNodeId: <String>,
 * }
 */
_deleteServerNode = async params => {
  let account = params.account;
  let deletedNodeId = params.deletedNodeId;

  var options = {
    resolveWithFullResponse: true,
    method: "DELETE",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      deletedNodeId,
    headers: {
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    // Set the issyncing flag to on so that the client can know if the syncing progress is still going
    accountModel.syncStart(account.id);
    let response = await request(options);

    // Set the sync completed time and also set issync flag to off
    accountModel.syncComplete(account.id);

    if (response.statusCode == 204) {
      // Delete the record from the DB
      await nodeModel.delete({
        account: account,
        nodeId: deletedNodeId
      });

      // Add an event log
      eventLogModel.add(
        account.id,
        "DELETE_NODE",
        `Deleting NodeId: ${deletedNodeId} from ${account.instance_url}`
      );
    }

    return response.statusCode;
  } catch (error) {
    // Looks like the node was not available on the server, no point in keeping the record in the DB
    // So lets delete it
    if (error.statusCode == 404) {
      await nodeModel.delete({
        account: account,
        nodeId: deletedNodeId
      });
    } else {
      errorLogModel.add(account.id, error);
    }

    // Set the sync completed time and also set issync flag to off
    accountModel.syncComplete(account.id);
  }
};

/**
 *
 * @param object filePath
 * {
 *  filePath: <String>
 * }
 */
_getFileModifiedTime = function(filePath) {
  let fileModifiedDate = new Date().getTime();
  if (fs.existsSync(filePath)) {
    let fileStat = fs.statSync(filePath);
    let fileModifiedDate = Date.parse(fileStat.mtime) / 1000;
  }

  return fileModifiedDate;
};
