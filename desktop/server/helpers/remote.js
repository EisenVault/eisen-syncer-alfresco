const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const request = require("request-promise-native");
const emitter = require('../helpers/emitter').emitter;
const errorLogModel = require("../models/log-error");
const eventLogModel = require("../models/log-event");
const nodeModel = require("../models/node");
const token = require("./token");
const _base = require("./syncers/_base");

// Logger
const { logger } = require("./logger");

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
    let response = await request(options)
      .on('error', function (e) {
        console.error(e);
        return;
      });

    return JSON.parse(response);
  } catch (error) {
    await errorLogModel.add(account.id, error);
  }
};

/**
 * @param object params
 * {
 *  nodeId: string
 * }
 */
exports.getNode = async params => {
  let account = params.account;
  let record = params.record;

  if (!record || !account) {
    throw new Error("Invalid paramerters");
  }

  var options = {
    method: "GET",
    url: `${account.instance_url}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${record.node_id}?include=path`,
    headers: {
      authorization: "Basic " + (await token.get(account))
    }
  };

  request(options)
    .then(response => {
      emitter.emit('getNode' + record.node_id, {
        account,
        record,
        statusCode: 200,
        response: JSON.parse(String(response))
      });
    })
    .catch(error => {
      emitter.emit('getNode' + record.node_id, {
        account,
        record,
        statusCode: error.statusCode,
        response: {}
      });
      errorLogModel.add(account.id, error);
    });
};


/**
 * @param object params
 * {
 *  nodeId: string
 * }
 */
exports.getNodeByNodeId = async params => {
  let account = params.account;
  let nodeId = params.nodeId;

  if (!nodeId || !account) {
    throw new Error("Invalid paramerters");
  }

  var options = {
    method: "GET",
    url: `${account.instance_url}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${nodeId}?include=path`,
    headers: {
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    const response = await request(options);
    return JSON.parse(response);
  } catch (error) {
    errorLogModel.add(account.id, error);
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
  let maxItems = params.maxItems || 100;

  if (!account) {
    throw new Error("Account not found");
  }

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      parentNodeId +
      "/children?include=path&maxItems=" +
      maxItems,
    headers: {
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    let response = await request(options)
      .on('error', function (e) {
        console.error(e);
        return;
      });
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
  let record = params.record;

  var options = {
    resolveWithFullResponse: true,
    method: "DELETE",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      record.node_id,
    headers: {
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    let response = await request(options)
      .on('error', function (e) {
        console.error(e);
        return;
      });

    if (response.statusCode == 204) {
      // Delete the record from the DB
      if (record.is_file === 1) {
        await nodeModel.forceDelete({
          account,
          nodeId: record.node_id
        });
      } else if (record.is_folder === 1) {
        await nodeModel.forceDeleteAllByFileOrFolderPath({
          account,
          path: record.file_path
        });
      }

      // Add an event log
      await eventLogModel.add(
        account.id,
        "DELETE_NODE",
        `Deleted NodeId: ${record.node_id} from ${account.instance_url}`
      );
    }

    return response.statusCode;
  } catch (error) {
    // Looks like the node was not available on the server, no point in keeping the record in the DB
    // So lets delete it
    if (error.statusCode == 404) {
      await nodeModel.forceDelete({
        account: account,
        nodeId: record.node_id
      });
    } else {
      await errorLogModel.add(account.id, error);
    }
  }
};

/**
 *
 * @param object params
 */
exports.download = async params => {
  const account = params.account;
  const watcher = params.watcher;
  const node = params.node;
  const destinationPath = params.destinationPath;
  const remoteFolderPath = params.remoteFolderPath;

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      node.id +
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

    await request(options)
      .on('error', function (e) {
        console.error(e);
        return;
      })
      .pipe(fs.createWriteStream(destinationPath));

    let modifiedDate = _base.getFileModifiedTime(destinationPath);
    if (modifiedDate === 0) {
      const serverNode = await this.getNodeByNodeId({
        account,
        nodeId: node.id
      });
      if (serverNode) {
        modifiedDate = _base.convertToUTC(serverNode.entry.modifiedAt);
      }
    }

    // Add refrence to the nodes table
    await nodeModel.add({
      account: account,
      watcher,
      nodeId: node.id,
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
      `Downloaded File: ${destinationPath} from ${account.instance_url}`
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
  let watcher = params.watcher;
  let filePath = params.filePath;
  let rootNodeId = params.rootNodeId;
  let options = {};

  if (!account) {
    throw new Error("Account not found");
  }

  // If its a directory, send a request to create the directory.
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    let directoryName = path.basename(params.filePath);
    let relativePath = path.dirname(filePath)
      .split('documentLibrary')[1]
      .replace(/^\/|\/$/g, '');

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
      let response = await request(options)
        .on('error', function (e) {
          console.error(e);
          return;
        });
      response = JSON.parse(response.body);

      if (response && response.entry.id) {
        // Add a record in the db
        await nodeModel.add({
          account,
          watcher,
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
    let relativePath = path.dirname(filePath).split('documentLibrary')[1].replace(/^\/|\/$/g, '');

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
        relativePath: relativePath,
        overwrite: "true"
      }
    };

    try {
      let response = await request(options)
        .on('error', function (e) {
          console.error(e);
        });

      response = JSON.parse(response.body);

      if (response && response.entry.id) {
        // Add a record in the db
        await nodeModel.add({
          account: account,
          watcher,
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
  const INTERVAL = 10;
  let { account, filePath, node, action } = params;

  // UPLOAD Guard
  if (action && action.toUpperCase() === "UPLOAD") {
    const record = await nodeModel.getOneByFilePath({
      account,
      filePath
    });

    // Check if the file was just downloaded, bail out!
    if (
      record &&
      _base.getCurrentTime() - record.last_downloaded_at <= INTERVAL
    ) {
      // logger.info(`Upload blocked 1: ${filePath}`);
      return false;
    }

    // If the file was already uploaded, bail out!
    if (
      record &&
      _base.getFileModifiedTime(record.file_path) - record.last_uploaded_at <=
      INTERVAL
    ) {
      // logger.info(`Upload blocked 2: ${record.file_path}`);
      return false;
    }
  }

  // DOWNLOAD Guard
  if (action && action.toUpperCase() === "DOWNLOAD") {
    const record = await nodeModel.getOneByFilePath({
      account,
      filePath
    });
    // Check if the file was just uploaded, bail out!
    if (
      record &&
      _base.getCurrentTime() - record.last_uploaded_at <= INTERVAL
    ) {
      // logger.info(`Download blocked 1: ${filePath}`);
      return false;
    }

    // If the latest file was already downloaded, bail out!
    if (
      record &&
      _base.convertToUTC(node.modified_at) - record.last_downloaded_at <=
      INTERVAL
    ) {
      // logger.info(`Download blocked 2: ${filePath}`);
      return false;
    }
  }

  // Only allow if its happening under the watched folder
  let watchFolder = account.watch_folder.split("documentLibrary").pop();
  let relativeFilePath = filePath.replace(account.sync_path, "");

  // Strip any starting slashes..
  watchFolder = watchFolder.replace(/[\/|\\]/, "");
  relativeFilePath = relativeFilePath.replace(/[\/|\\]/, "").split("/")[0];

  // If the folder or file being uploaded does not belong to the watched folder and if the watched folder is not the documentLibrary, bail out!
  if (watchFolder !== "" && watchFolder !== relativeFilePath) {
    logger.info(`Bailed ${relativeFilePath}`);
    return false;
  }

  return true;
};
