const fs = require("fs");
const path = require("path");
const btoa = require("btoa");
const request = require("request-promise-native");
const accountModel = require("../models/account");
const remote = require("./remote");
const nodeModel = require("../models/node");

/**
 *
 * @param object params
 * {
 *  accountId: '',
 *  sourcePath: '',
 *  destinationNodeId: '',
 *  uploadDirectory: '',
 *  overwrite: true/false
 * }
 */
exports.upload = async params => {
  let accountId = params.accountId;
  let sourcePath = params.sourcePath;
  let filename = path.basename(params.sourcePath);
  let destinationNodeId = params.destinationNodeId;
  let uploadDirectory = params.uploadDirectory;
  let overwrite = params.overwrite;

  let account = await accountModel.getOne(accountId);

  if (!account) {
    throw new Error("Account not found");
  }

  var options = {
    resolveWithFullResponse: true,
    method: "POST",
    url: account.instance_url + "/alfresco/service/api/upload",
    headers: {
      authorization: "Basic " + btoa(account.username + ":" + account.password)
    },
    formData: {
      filedata: {
        value: fs.createReadStream(sourcePath),
        options: {}
      },
      filename: filename,
      destination: "workspace://SpacesStore/" + destinationNodeId,
      uploadDirectory: uploadDirectory,
      overwrite: overwrite
    }
  };

  try {
    let response = await request(options);
    return response.body;
  } catch (error) {
    throw new Error(error);
  }
};

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  sourceNodeId: '',
 *  destinationPath: '',
 * }
 */
exports.download = async params => {
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
 * @param object params
 * {
 *  account: Account<Object>,
 *  sourceNodeId: '',
 *  destinationPath: '',
 * }
 */
exports.recursive = async params => {
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
      fileModifiedDate = new Date().getTime();
      if (fs.existsSync(currentDirectory)) {
        let fileStat = fs.statSync(currentDirectory);
        let fileModifiedDate = Date.parse(fileStat.mtime) / 1000;
      }

      // Push the node id to the global container
      serverNodeList.push(currentDirectory);

      // Check if the modified date of the file/folder is greater than the modified date in the DB, then proceed with updating/downloading the file/folder
      let existingNode = await nodeModel.getOne({
        accountId: account.id,
        nodeId: sourceNodeId,
        localPath: currentDirectory,
        fileUpdateAt: fileModifiedDate
      });

      if (existingNode) {
        console.log("Ignoring: " + currentDirectory);
        // If the file/folder modified date is same as the one we have on our records then we will ignore this and no action will be taken.
        continue;
      }
      console.log("UPDATING: " + currentDirectory);
      // Add the file information to the DB
      await nodeModel.add({
        accountId: account.id,
        nodeId: sourceNodeId,
        fileName: child.entry.name,
        localPath: currentDirectory,
        fileUpdateAt: fileModifiedDate,
        isFolder: child.entry.isFolder,
        isFile: child.entry.isFile
      });

      if (child.entry.isFolder == true) {
        // If the child is a folder, create the folder first
        if (!fs.existsSync(destinationPath + "/" + child.entry.name)) {
          fs.mkdirSync(currentDirectory);
        }

        this.recursive({
          account: account,
          sourceNodeId: sourceNodeId,
          destinationPath: currentDirectory
        });
      } else if (child.entry.isFile == true) {
        // If its a file, download it in the current directory
        await this.download({
          account: account,
          sourceNodeId: sourceNodeId,
          destinationPath: currentDirectory
        });
      }
    }

    // Looks like that the iteration of the current folder is complete,
    // lets check if all node matches the one we have on records,
    // else we will consider the remote file/folder was deleted and we will have to delete the same on our local
    let missingFiles = await nodeModel.getMissingFiles({
      accountId: account.id,
      nodeList: serverNodeList
    });

    console.log('missingFiles', missingFiles);
    console.log('serverNodeList', serverNodeList);
  } catch (error) {
    console.log("ERROR OCCURRED: ", error);
  }
};
