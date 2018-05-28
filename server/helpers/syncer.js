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
var progress = require("progress-stream");

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

    // Since its not quite possible to know if the iteration is fully completed as its not possible to know how many total items should be downloaded,
    // So a workaround is to update the last_sync_at timestamp of the account.
    // To know if the sync has completed or not, we will check the difference between current time and the last_sync_at and if its more than 20 seconds, we will consider the sync is complete
    accountModel.updateSyncTime(account.id);
  } catch (error) {
    errorLogModel.add(account.id, error);
    console.log("ERROR OCCURRED: ", error);
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
 * }
 */
exports.recursiveUpload = async params => {
  let account = params.account;
  let rootFolder = account.sync_path;
  let rootNodeId = params.rootNodeId;
  let overwrite = params.overwrite;

  // This function will list all files/folders/sub-folders recursively.
  let getDirectories = function(src, callback) {
    glob(src + "/**/*", callback);
  };

  getDirectories(rootFolder, async (error, localFilePathList) => {
    if (error) {
      // Add an error log
      errorLogModel.add(
        account.id,
        "Error occured during listing files/folders. " + error
      );
      console.log("Error occured during listing files/folders", error);
    } else {
      // Get the list of all nodes that are locally deleted.
      let deletedNodes = await nodeModel.getDeletedNodeList({
        account: account,
        localFilePathList: localFilePathList
      });

      // Recursively delete all files from the server that are deleted on local
      for (let deletedNodeId of deletedNodes) {
        try {
          let deletedResponse = await _deleteServerNode({
            account: account,
            deletedNodeId: deletedNodeId
          });

          // If the node was successfully deleted from the server, we will remove it from the DB as well
          if (deletedResponse == 204) {
            nodeModel.delete({
              account: account,
              nodeId: deletedNodeId
            });
          }
        } catch (error) {
          // Looks like the file was deleted from the server and local, lets delete the record in that case
          nodeModel.delete({
            account: account,
            nodeId: deletedNodeId
          });
        }
      }

      // Next, get the list of files that are newly created on local
      let newFileList = await nodeModel.getNewFileList({
        account: account,
        localFilePathList: localFilePathList
      });

      for (let localFilePath of newFileList) {
        // Get the nodeid of the folder from the DB so that we can upload the current file/folder inside its target folder
        let folderNodeId = await nodeModel.getFolderNodeId({
          account: account,
          rootNodeId: rootNodeId,
          localFilePath: localFilePath
        });

        try {
          // Upload the new files to the server
          let serverResponseNodeId = await _upload({
            account: account,
            filePath: localFilePath,
            rootNodeId: rootNodeId,
            overwrite: overwrite
          });

          if (serverResponseNodeId) {
            // Since we have uploaded the file/folder to the server, lets add a record for the same in the DB
            await nodeModel.add({
              account: account,
              nodeId: serverResponseNodeId,
              fileName: path.basename(localFilePath),
              filePath: localFilePath,
              fileUpdateAt: _getFileModifiedTime(localFilePath),
              isFolder: fs.statSync(localFilePath).isDirectory(),
              isFile: fs.statSync(localFilePath).isFile()
            });
          }
        } catch (error) {
          // When uploading duplicate folders, the api complains with a 409 http status code, but we can safely ignore this error
          if (error.statusCode != 409) {
            console.log(error);
          } else {
            errorLogModel.add(account.id, error);
          }
        }
      }
    }
  });
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
  let overwrite = params.overwrite;
  let options = false;

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
        authorization:
          "Basic " +
          btoa(account.username + ":" + crypt.decrypt(account.password))
      },
      body: JSON.stringify({
        name: directoryName,
        nodeType: "cm:folder",
        relativePath: relativePath
      })
    };

    try {
      let response = await request(options);
      response = JSON.parse(response.body);

      if (response.entry.id) {
        // Since its not quite possible to know if the iteration is fully completed as its not possible to know how many total items should be downloaded,
        // So a workaround is to update the last_sync_at timestamp of the account.
        // To know if the sync has completed or not, we will check the difference between current time and the last_sync_at and if its more than 20 seconds, we will consider the sync is complete
        accountModel.updateSyncTime(account.id);

        // Add an event log
        eventLogModel.add(
          account.id,
          "UPLOAD_FOLDER",
          `Uploaded Folder: ${filePath} to ${account.instance_url}`
        );
        return response.entry.id;
      }
    } catch (error) {
      // Add an error log
      errorLogModel.add(account.id, error);
    }

    return false;
  }

  // If its a file, send a request to upload the file.
  if (fs.statSync(filePath).isFile()) {
    let uploadDirectory = path.dirname(filePath);
    uploadDirectory = uploadDirectory
      .replace(account.sync_path, "")
      .substring(1);

    console.log("Uploading", filePath);

    options = {
      resolveWithFullResponse: true,
      method: "POST",
      url: account.instance_url + "/alfresco/service/api/upload",
      headers: {
        authorization:
          "Basic " +
          btoa(account.username + ":" + crypt.decrypt(account.password))
      },
      formData: {
        filedata: {
          value: fs.createReadStream(filePath),
          options: {}
        },
        filename: path.basename(params.filePath),
        destination: "workspace://SpacesStore/" + rootNodeId,
        uploadDirectory: uploadDirectory,
        overwrite: overwrite
      }
    };
  }

  if (_.isEmpty(options)) {
    return false;
  }

  try {
    let response = await request(options);
    response = JSON.parse(response.body);
    let refId = response.nodeRef.split("workspace://SpacesStore/");

    if (refId[1]) {
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
    console.log(error);
    throw new Error(error);
  }
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
      authorization:
        "Basic " +
        btoa(account.username + ":" + crypt.decrypt(account.password))
    }
  };

  try {
    let response = await request(options);

    // Since its not quite possible to know if the iteration is fully completed as its not possible to know how many total items should be downloaded,
    // So a workaround is to update the last_sync_at timestamp of the account.
    // To know if the sync has completed or not, we will check the difference between current time and the last_sync_at and if its more than 20 seconds, we will consider the sync is complete
    accountModel.updateSyncTime(account.id);

    // Add an event log
    eventLogModel.add(
      account.id,
      "DELETE_NODE",
      `Deleting NodeId: ${deletedNodeId} from ${account.instance_url}`
    );

    return response.statusCode;
  } catch (error) {
    errorLogModel.add(account.id, error);
    throw new Error(error);
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
      authorization:
        "Basic " +
        btoa(account.username + ":" + crypt.decrypt(account.password))
    }
  };

  try {
    let response = await request(options).pipe(
      fs.createWriteStream(destinationPath)
    );

    fs.watchFile(destinationPath, function() {
      fs.stat(destinationPath, function(err, stats) {
        // Since its not quite possible to know if the iteration is fully completed as its not possible to know how many total items should be downloaded,
        // So a workaround is to update the last_sync_at timestamp of the account.
        // To know if the sync has completed or not, we will check the difference between current time and the last_sync_at and if its more than 20 seconds, we will consider the sync is complete
        accountModel.updateSyncTime(account.id);
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
    throw new Error(error);
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
