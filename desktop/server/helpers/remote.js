const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const request = require("request-promise-native");
const errorLogModel = require("../models/log-error");
const eventLogModel = require("../models/log-event");
const nodeModel = require("../models/node");
const token = require("./token");
const _base = require("./syncers/_base");

// Loggers
const errorLog = require('../helpers/logger').errorlog;
const successlog = require('../helpers/logger').successlog;

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  nodeId: string
 * }
 */
exports.getNodeList = async params => {
  let account = params.account;
  let nodeId = params.nodeId;
  let maxItems = params.maxItems || 10;
  let skipCount = params.skipCount || 0;

  if (!account) {
    throw new Error("Account not found");
  }

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/s/com/eisenvault/totalNodesCount/" +
      nodeId +
      "/shownodes?maxItems=" +
      maxItems +
      "&skipCount=" +
      skipCount,
    headers: {
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    let response = await request(options);
    return JSON.parse(response);
  } catch (error) {
    await errorLogModel.add(account.id, error);
  }
};

/**
 *
 * @param object params
 * {
 *  nodeId: string
 * }
 */
exports.getNode = async params => {
  let account = params.account;
  let nodeId = params.nodeId;

  if (!nodeId || !account) {
    throw new Error("Invalid paramerters");
  }

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      nodeId,
    headers: {
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    let response = await request(options);
    return JSON.parse(response);
  } catch (error) {
    await errorLogModel.add(account.id, error);
  }
};

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
    await errorLogModel.add(account.id, error);
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
    let response = await request(options);

    if (response.statusCode == 204) {
      successlog.info("Deleted", deletedNodeId);

      // Delete the record from the DB
      await nodeModel.delete({
        account: account,
        nodeId: deletedNodeId
      });

      // Add an event log
      await eventLogModel.add(
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
      await errorLogModel.add(account.id, error);
    }
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
  let remoteFolderPath = params.remoteFolderPath;

  if (
    (await this.watchFolderGuard({
      account,
      filePath: destinationPath,
      action: "DOWNLOAD"
    })) === false
  ) {
    return;
  }

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
    // Create the folder chain before downloading the file
    let destinationDirectory = path.dirname(destinationPath);
    if (!fs.existsSync(destinationDirectory)) {
      mkdirp.sync(destinationDirectory);
    }

    await request(options).pipe(fs.createWriteStream(destinationPath));

    let modifiedDate = _base.getFileModifiedTime(destinationPath);
    if (modifiedDate === 0) {
      const node = await this.getNode({
        account: account,
        nodeId: sourceNodeId
      });
      modifiedDate = _base.convertToUTC(node.entry.modifiedAt);
    }

    // Add refrence to the nodes table
    await nodeModel.add({
      account: account,
      nodeId: sourceNodeId,
      remoteFolderPath: remoteFolderPath,
      filePath: destinationPath,
      fileUpdateAt: modifiedDate,
      lastDownloadedAt: _base.getCurrentTime(),
      isFolder: false,
      isFile: true
    });

    // Add an event log
    await eventLogModel.add(
      account.id,
      "DOWNLOAD_FILE",
      `Downloading File: ${destinationPath} from ${account.instance_url}`
    );
    return params;
  } catch (error) {
    await errorLogModel.add(account.id, error);
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
 * }
 */
exports.upload = async params => {
  let account = params.account;
  let filePath = params.filePath;
  let rootNodeId = params.rootNodeId;
  let options = {};

  if (!account) {
    throw new Error("Account not found");
  }

  if (
    (await this.watchFolderGuard({
      account,
      filePath,
      action: "UPLOAD"
    })) === false
  ) {
    return;
  }

  // If its a directory, send a request to create the directory.
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
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
        "/children?include=path",
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
      let response = await request(options);
      response = JSON.parse(response.body);

      if (response.entry.id) {
        // Add a record in the db
        await nodeModel.add({
          account: account,
          nodeId: response.entry.id,
          remoteFolderPath: response.entry.path.name,
          filePath: params.filePath,
          fileUpdateAt: _base.convertToUTC(response.entry.modifiedAt),
          lastUploadedAt: _base.getCurrentTime(),
          isFolder: true,
          isFile: false
        });

        // Add an event log
        await eventLogModel.add(
          account.id,
          "UPLOAD_FOLDER",
          `Uploaded Folder: ${filePath} to ${account.instance_url}`
        );
        return response.entry.id;
      }
    } catch (error) {
      // Ignore "duplicate" status codes
      if (error.statusCode == 409) {
        // In case of duplicate error, we will update the file modified date to the db so that it does not try to update next time
        nodeModel.updateModifiedTime({
          account: account,
          filePath: filePath,
          fileUpdateAt: _base.getFileModifiedTime(params.filePath)
        });
      } else {
        // Add an error log
        await errorLogModel.add(account.id, error);
      }
    }

    return false;
  }

  // If its a file, send a request to upload the file.
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    let uploadDirectory = path.dirname(filePath);
    uploadDirectory = uploadDirectory
      .replace(account.sync_path, "")
      .substring(1);

    options = {
      resolveWithFullResponse: true,
      method: "POST",
      url: `${
        account.instance_url
        }/alfresco/api/-default-/public/alfresco/versions/1/nodes/${rootNodeId}/children?include=path`,
      headers: {
        Authorization: "Basic " + (await token.get(account))
      },
      formData: {
        filedata: {
          value: fs.createReadStream(filePath),
          options: {}
        },
        name: path.basename(filePath),
        relativePath: uploadDirectory,
        overwrite: "true"
      }
    };

    try {
      let response = await request(options);
      response = JSON.parse(response.body);

      if (response.entry.id) {
        // Add a record in the db
        await nodeModel.add({
          account: account,
          nodeId: response.entry.id,
          remoteFolderPath: response.entry.path.name,
          filePath: params.filePath,
          fileUpdateAt: _base.convertToUTC(response.entry.modifiedAt),
          lastUploadedAt: _base.getCurrentTime(),
          isFolder: false,
          isFile: true
        });

        // Add an event log
        await eventLogModel.add(
          account.id,
          "UPLOAD_FILE",
          `Uploaded File: ${filePath} to ${account.instance_url}`
        );
        return response.entry.id;
      }

      return false;
    } catch (error) {
      // Ignore "duplicate" status codes
      if (error.statusCode == 409) {
        // In case of duplicate error, we will update the file modified date to the db so that it does not try to update next time
        nodeModel.updateModifiedTime({
          account: account,
          filePath: filePath,
          fileUpdateAt: _base.getFileModifiedTime(params.filePath)
        });
      } else {
        // Add an error log
        await errorLogModel.add(account.id, error);
      }
    }
  }

  return false;
};

exports.watchFolderGuard = async params => {
  let { account, filePath, action } = params;

  if (action && action.toUpperCase() === "UPLOAD") {
    // Check if the file was just downloaded, bail out!
    const node = await nodeModel.getOneByFilePath({
      account,
      filePath
    });

    if (node && _base.getCurrentTime() - node.last_downloaded_at <= 15) {
      return false;
    }
  } else if (action && action.toUpperCase() === "DOWNLOAD") {
    // Check if the file was just uploaded, bail out!
    const node = await nodeModel.getOneByFilePath({
      account,
      filePath
    });

    if (node && _base.getCurrentTime() - node.last_uploaded_at <= 15) {
      return false;
    }
  }

  // Only upload stuffs that are happening under the watched folder
  let watchFolder = account.watch_folder.split("documentLibrary").pop();
  let relativeFilePath = filePath.replace(account.sync_path, "");

  // Strip any starting slashes..
  watchFolder =
    watchFolder[0] === "/"
      ? watchFolder.substring(1, watchFolder.length)
      : watchFolder;

  relativeFilePath =
    relativeFilePath[0] === "/"
      ? relativeFilePath.substring(1, relativeFilePath.length)
      : relativeFilePath;

  relativeFilePath = relativeFilePath.split("/")[0];

  // If the folder or file being uploaded does not belong to the watched folder and if the watched folder is not the documentLibrary, bail out!
  if (watchFolder !== '' && watchFolder !== relativeFilePath) {
    return false;
  }

  return true;
};
