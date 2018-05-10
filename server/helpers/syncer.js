const fs = require("fs");
const _ = require("lodash");
const path = require("path");
const btoa = require("btoa");
const request = require("request-promise-native");
const accountModel = require("../models/account");
const remote = require("./remote");
const nodeModel = require("../models/node");
const glob = require("glob");

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  sourceNodeId: '',
 *  destinationPath: '',
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
        // If its a file, download it in the current directory
        await _download({
          account: account,
          sourceNodeId: sourceNodeId,
          destinationPath: currentDirectory
        });
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
          } else {
            // Delete the file
            fs.unlinkSync(file.file_path);
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
        deleteFolderRecursive(curPath);
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

  getDirectories(rootFolder, async function(error, localFilePathList) {
    if (error) {
      console.log("Error occured during listing files/folders", error);
    } else {
      // Get the list of files/folders that are newly created on local
      let newFileList = await nodeModel.getNewFileList({
        account: account,
        localFilePathList: localFilePathList
      });

      // Upload the new files/folders to the server
      for (let localFilePath of newFileList) {
        let folderNodeId = await nodeModel.getFolderNodeId({
          account: account,
          rootNodeId: rootNodeId,
          localFilePath: localFilePath
        });

        try {
          let serverResponseNodeId = await _upload({
            account: account,
            filePath: localFilePath,
            destinationNodeId: folderNodeId,
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
              isFile: fs.statSync(localFilePath).isDirectory()
            });
          }
        } catch (error) {
          console.log(error);
        }
      }
    }
  });
};

/**
 *
 * @param object params
 * {
 *  account: '',
 *  filePath: '',
 *  destinationNodeId: '',
 *  uploadDirectory: '',
 *  overwrite: true/false
 * }
 */
_upload = async params => {
  let account = params.account;
  let filePath = params.filePath;
  let destinationNodeId = params.destinationNodeId;
  // let uploadDirectory = params.uploadDirectory || "";
  let overwrite = params.overwrite;

  if (!account) {
    throw new Error("Account not found");
  }

  let uploadDirectory = path.dirname(filePath);
  uploadDirectory = uploadDirectory.replace(account.sync_path, "").substring(1);

  // If its a directory, send a request to create the directory.
  if (fs.statSync(filePath).isDirectory()) {

    let options = {
      resolveWithFullResponse: true,
      method: "POST",
      url:
        account.instance_url +
        "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
        destinationNodeId +
        "/children",
      headers: {
        "content-type": "application/json",
        authorization:
          "Basic " + btoa(account.username + ":" + account.password)
      },
      body: JSON.stringify({
        name: path.basename(params.filePath),
        nodeType: "cm:folder",
        relativePath: uploadDirectory
      })
    };

    let response = await request(options);

    if (_.has("id", response.body.entry)) {
      return response.body.entry.id;
    }

    return false;
  }

  let options = {
    resolveWithFullResponse: true,
    method: "POST",
    url: account.instance_url + "/alfresco/service/api/upload",
    headers: {
      authorization: "Basic " + btoa(account.username + ":" + account.password)
    },
    formData: {
      filedata: {
        value: fs.createReadStream(filePath),
        options: {}
      },
      filename: path.basename(params.filePath),
      destination: "workspace://SpacesStore/" + destinationNodeId,
      uploadDirectory: uploadDirectory,
      overwrite: overwrite
    }
  };

  try {
    let response = await request(options);
    response = JSON.parse(response.body);
    let refId = response.nodeRef.split("workspace://SpacesStore/");
    return refId[1];
  } catch (error) {
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
      authorization: "Basic " + btoa(account.username + ":" + account.password)
    }
  };

  try {
    let response = await request(options).pipe(
      fs.createWriteStream(destinationPath)
    );
    return params;
  } catch (error) {
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
