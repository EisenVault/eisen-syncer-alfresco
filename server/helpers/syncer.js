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
  let serverNodeList = [];

  try {
    // Get all the child items of the given nodeid
    let childrens = await remote.getChildren({
      account: account,
      parentNodeId: sourceNodeId
    });

    for (let child of childrens.list.entries) {
      let currentDirectory = path.join(destinationPath, child.entry.name);
      let sourceNodeId = child.entry.id;

      // Get the modified date of the file/folder
      fileModifiedDate = _getFileModifiedTime(currentDirectory);

      // Push the node id to the global container
      serverNodeList.push(child.entry.id);

      // Check if the node already exists in the DB records.
      let recordExists = await nodeModel.getOne({
        account: account,
        nodeId: child.entry.id,
        fileUpdateAt: _getFileModifiedTime(currentDirectory)
      });

      // Add the file information to the DB. If the node is already present and the last modified time of file is different in the DB then update the last modified time
      await nodeModel.add({
        account: account,
        nodeId: sourceNodeId,
        fileName: child.entry.name,
        filePath: currentDirectory,
        fileUpdateAt: fileModifiedDate,
        isFolder: child.entry.isFolder,
        isFile: child.entry.isFile
      });

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
        if (_.isEmpty(recordExists)) {
          await _download({
            account: account,
            sourceNodeId: sourceNodeId,
            destinationPath: currentDirectory
          });
        }
      }
    }

    // Looks like that the iteration of the current folder is complete,
    // so lets check if all node matches the one we have on records,
    // else we will consider the remote file/folder was deleted and we will have to delete the same on our local
    let missingFiles = await nodeModel.getMissingFiles({
      account: account,
      nodeList: serverNodeList,
      folderPath: destinationPath
    });

    if (!_.isEmpty(missingFiles)) {
      for (let file of missingFiles) {
        if (fs.existsSync(file.file_path)) {
          if (file.is_folder == 1) {
            // Delete the folder
            _deleteFolderRecursive(file.file_path);
            // Add an event log
            eventLogModel.add(
              account.id,
              "DELETE_FOLDER",
              `Deleted Folder: ${file.file_path}`
            );
          } else {
            // Delete the file
            fs.unlinkSync(file.file_path);
            // Add an event log
            eventLogModel.add(
              account.id,
              "DELETE_FILE",
              `Deleted File: ${file.file_path}`
            );
          }
        }

        // Delete the record from the DB
        await nodeModel.delete({
          account: account,
          nodeId: file.node_id
        });
      }
    }
  } catch (error) {
    errorLogModel.add(account.id, error);
    console.log("ERROR OCCURRED: ", error);
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

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  rootNodeId: string,
 * }
 */
exports.directoryWalk = async params => {
  let account = params.account;
  let rootFolder = params.sync_path || account.sync_path;
  let overwrite = account.overwrite;
  let rootNodeId = params.rootNodeId;

  if (fs.statSync(rootFolder).isDirectory()) {
    rootFolder = rootFolder + "/**/*";
  }

  // This function will list all files/folders/sub-folders recursively.
  glob(rootFolder, async (error, localFilePathList) => {
    // Iterate through each file and perform certain task
    for (let filePath of localFilePathList) {
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

    // TODO CASE 3: Check if file is present in DB but missing on local disk (file was deleted on local)
    // Delete node from server and once response received, delete record from DB.
    // await this.deleteMissingFiles({
    //   account: account,
    //   fileList: localFilePathList
    // });
  });
};

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  fileList: array,
 * }
 */
exports.deleteMissingFiles = async params => {
  let account = params.account;
  let filePath = params.filePath;

  let record = await nodeModel.getOneByFileOrFolderPath({
    account: account,
    path: filePath
  });

  if (!record) {
    console.log("No Record For", filePath);
  } else {
    console.log("Filepath", filePath);
  }

  // If the deleted item was a directory, remove all records for that folder
  if (record && record.is_folder == 1) {
    let records = await nodeModel.getAllByFolderPath({
      account: account,
      folderPath: filePath
    });

    for (let node of records) {
      // Delete the node from the server, once thats done it will delete the record from the DB as well
      _deleteServerNode({
        account: account,
        deletedNodeId: node.node_id
      });
    }
  }

  // If the deleted item was a file, remove that record
  if (record && record.is_file == 1) {
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
          fileName: path.basename(params.filePath),
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
          fileName: path.basename(params.filePath),
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

    console.log("Deleting: ", deletedNodeId);

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
