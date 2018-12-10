const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const request = require("request-promise-native");
const request2 = require("request");
const emitter = require('../helpers/emitter').emitter;
const errorLogModel = require("../models/log-error");
const eventLogModel = require("../models/log-event");
const nodeModel = require("../models/node");
const token = require("./token");
const _base = require("./syncers/_base");
const Utimes = require('@ronomon/utimes');

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
      Connection: "keep-alive",
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
    await errorLogModel.add(account.id, error, `${__filename}/getNodeList`);
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

  if (record.node_id === '') {
    return;
  }

  var options = {
    method: "GET",
    url: `${account.instance_url}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${record.node_id}?include=path`,
    headers: {
      Connection: "keep-alive",
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
      errorLogModel.add(account.id, error, `${__filename}/getNode/${record.node_id}`);
    });
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
      Connection: "keep-alive",
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
    await errorLogModel.add(account.id, error, `${__filename}/getChildren`);
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
      Connection: "keep-alive",
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
      await errorLogModel.add(account.id, error, `${__filename}/getServerNode`);
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
      Connection: "keep-alive",
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    // Create the folder chain before downloading the file
    let destinationDirectory = path.dirname(destinationPath);
    if (!fs.existsSync(destinationDirectory)) {
      mkdirp.sync(destinationDirectory);
    }

    // work in progress.....
    // when a file is in progress, how do you expect it to have a modified time?
    // figure out why some of the downloaded files are not updateing the time
    // Add refrence to the nodes table
    await nodeModel.add({
      account,
      watcher,
      nodeId: node.id,
      remoteFolderPath,
      filePath: destinationPath,
      fileUpdateAt: 0,
      lastDownloadedAt: _base.getCurrentTime(),
      isFolder: false,
      isFile: true,
      downloadInProgress: true
    });

    var totalBytes = 0;
    var recievedSize = 0;
    await request(options)
      .on('error', function (e) {
        console.error('ON Error:...', e);
        return;
      })
      .on('response', async (data) => {
        totalBytes = data.headers['content-length'];
      })
      .on('data', async (chunk) => {

        recievedSize += chunk.length;
        // Make sure the download is complete
        if (recievedSize >= totalBytes) {
          // Update the time meta properties of the downloaded file
          const btime = _base.convertToUTC(node.createdAt);
          const mtime = _base.convertToUTC(node.modifiedAt);
          const atime = undefined;

          setTimeout(() => {
            Utimes.utimes(`${destinationPath}`, btime, mtime, atime, async () => {
              await nodeModel.setDownloadProgress({
                filePath: destinationPath,
                account,
                progress: false,
                fileUpdateAt: mtime
              });

              // Add an event log
              await eventLogModel.add(
                account.id,
                "DOWNLOAD_FILE",
                `Downloaded File: ${destinationPath} from ${account.instance_url}`
              );
            });
          }, 0);
        }
      })
      .pipe(fs.createWriteStream(destinationPath));

    return params;
  } catch (error) {
    await errorLogModel.add(account.id, error, `${__filename}/download`);
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
        Connection: "keep-alive",
        "content-type": "application/json",
        Authorization: "Basic " + (await token.get(account))
      },
      body: JSON.stringify({
        name: directoryName,
        nodeType: "cm:folder",
        relativePath
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
        // Update the time meta properties of the downloaded file
        const btime = _base.convertToUTC(response.entry.createdAt);
        const mtime = _base.convertToUTC(response.entry.modifiedAt);
        const atime = undefined;

        setTimeout(() => {
          Utimes.utimes(`${filePath}`, btime, mtime, atime, async () => {
            await nodeModel.add({
              account,
              watcher,
              nodeId: response.entry.id,
              remoteFolderPath: response.entry.path.name,
              filePath: filePath,
              fileUpdateAt: mtime,
              lastUploadedAt: _base.getCurrentTime(),
              isFolder: true,
              isFile: false,
              progress: false,
            });

            // Add an event log
            await eventLogModel.add(
              account.id,
              "UPLOAD_FOLDER",
              `Uploaded Folder: ${filePath} to ${account.instance_url}`
            );
          });
        }, 0);

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
        errorLogModel.add(account.id, error, `${__filename}/upload Directory`);
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
        Connection: "keep-alive",
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
      // Add a record in the db
      await nodeModel.add({
        account,
        watcher,
        nodeId: '',
        remoteFolderPath: '',
        filePath,
        fileUpdateAt: 0,
        lastUploadedAt: 0,
        isFolder: false,
        isFile: true,
        uploadInProgress: true
      });

      let response = await request(options)
        .then(async (response) => {
          response = JSON.parse(response.body);

          // Update the time meta properties of the downloaded file
          const btime = _base.convertToUTC(response.entry.createdAt);
          const mtime = _base.convertToUTC(response.entry.modifiedAt);
          const atime = undefined;

          setTimeout(() => {
            Utimes.utimes(`${filePath}`, btime, mtime, atime, async () => { });
          }, 0); //end setTimeout

          // Update the node record once uploaded
          await nodeModel.setUploadProgress({
            filePath,
            account,
            progress: false,
            nodeId: response.entry.id,
            remoteFolderPath: response.entry.path.name,
            fileUpdateAt: _base.convertToUTC(response.entry.modifiedAt),
            lastUploadedAt: _base.getCurrentTime(),
          });

          // Add an event log
          await eventLogModel.add(
            account.id,
            "UPLOAD_FILE",
            `Uploaded File: ${filePath} to ${account.instance_url}`
          );

        })
        .catch(async (error) => {
          // Ignore "duplicate" status codes
          if (error.statusCode == 409) {
            // In case of duplicate error, we will update the file modified date to the db so that it does not try to update next time
            await nodeModel.updateModifiedTime({
              account: account,
              filePath: filePath,
              fileUpdateAt: _base.getFileModifiedTime(params.filePath)
            });
          } else {
            // Add an error log
            // await errorLogModel.add(account.id, error, `${__filename}/upload file`);
            await nodeModel.deleteByPath({
              account,
              filePath
            });
          }
        })

    } catch (error) {
      // Add an error log
      await errorLogModel.add(account.id, error, `${__filename}/upload file`);
    }
  }

  return;
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
