const fs = require("fs");
const path = require("path");
const crypt = require("../config/crypt");
const btoa = require("btoa");
const request = require("request-promise-native");
const accountModel = require("../models/account");
const errorLogModel = require("../models/log-error");
const eventLogModel = require("../models/log-event");
const nodeModel = require("../models/node");
const token = require("../helpers/token");
const syncer = require("../helpers/syncer");

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  parentNodeId: ''
 * }
 */
exports.getChildren = async params => {
  let account = params.account;
  let parentNodeId = params.parentNodeId;

  if (!account) {
    throw new Error("Account not found");
  }

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      parentNodeId +
      "/children",
    headers: {
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    let response = await request(options);
    return JSON.parse(response);
  } catch (error) {
    errorLogModel.add(account.id, error);
  }
};

/**
 * @param object params
 * {
 *  account: <Object>,
 *  deletedNodeId: <String>,
 * }
 */
exports.deleteServerNode = async params => {
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
 * @param object params
 * {
 *  account: Account<Object>,
 *  sourceNodeId: <String>,
 *  destinationPath: <String>,
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
      fileUpdateAt: syncer.getFileModifiedTime(destinationPath),
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
exports.upload = async params => {
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
    let relativePath = filePath.replace(account.sync_path + "/", "");
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
          fileUpdateAt: syncer.getFileModifiedTime(params.filePath),
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
        console.log("Uploaded File", filePath);

        // Add a record in the db
        await nodeModel.add({
          account: account,
          nodeId: refId[1],
          filePath: params.filePath,
          fileUpdateAt: syncer.getFileModifiedTime(filePath),
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
