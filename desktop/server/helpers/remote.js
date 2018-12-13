const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const request = require("request-promise-native");
const emitter = require('../helpers/emitter').emitter;
const { add: errorLogAdd } = require("../models/log-error");
const { eventLogModel, types: eventType } = require("../models/log-event");
const { nodeModel } = require("../models/node");
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
    errorLogAdd(account.id, error, `${__filename}/getNodeList`);
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
      errorLogAdd(account.id, error, `${__filename}/getNode/${record.node_id}`);
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
    errorLogAdd(account.id, error, `${__filename}/getChildren`);
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
      await eventLogModel.create({
        account_id: account.id,
        type: eventType.DELETE_NODE,
        description: `Deleted NodeId: ${record.node_id} from ${account.instance_url}`
      });
    }

    return response.statusCode;
  } catch (error) {
    // Looks like the node was not available on the server, no point in keeping the record in the DB
    // So lets delete it
    if (error.statusCode == 404) {
      await nodeModel.destroy({
        where: {
          account_id: account.id,
          node_id: record.node_id
        }
      });
    } else {
      errorLogAdd(account.id, error, `${__filename}/getServerNode`);
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

    // Delete the record if it already exists
    await nodeModel.destroy({
      where: {
        account_id: account.id,
        file_path: _path.toUnix(currentPath)
      }
    });

    // Add reference to the nodes table
    await nodeModel.create({
      account_id: account.id,
      site_id: watcher.site_id,
      node_id: node.id,
      remote_folder_path: remoteFolderPath,
      file_name: path.basename(destinationPath),
      file_path: _path.toUnix(destinationPath),
      local_folder_path: path.dirname(destinationPath),
      file_update_at: _base.convertToUTC(node.modifiedAt),
      last_uploaded_at: 0,
      last_downloaded_at: _base.getCurrentTime(),
      is_folder: false,
      is_file: true,
      download_in_progress: 1,
      upload_in_progress: 0,
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
        console.log('ondata', chunk.length);

        recievedSize += chunk.length;
        // Make sure the download is complete
        if (recievedSize >= totalBytes) {
          // Update the time meta properties of the downloaded file
          const btime = _base.convertToUTC(node.createdAt);
          const mtime = _base.convertToUTC(node.modifiedAt);
          const atime = undefined;

          setTimeout(() => {
            Utimes.utimes(`${destinationPath}`, btime, mtime, atime, async () => {

              // set download progress to false
              await nodeModel.update({
                download_in_progress: 0,
                file_update_at: mtime
              }, {
                  where: {
                    account_id: account.id,
                    file_path: destinationPath
                  }
                });

              // Add an event log
              await eventLogModel.create({
                account_id: account.id,
                type: eventType.DOWNLOAD_FILE,
                description: `Downloaded File: ${destinationPath} from ${account.instance_url}`,
              });
            });
          }, 0);
        }
      })
      .pipe(fs.createWriteStream(destinationPath));

    return params;
  } catch (error) {
    errorLogAdd(account.id, error, `${__filename}/download`);
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

            await nodeModel.create({
              account_id: account.id,
              site_id: watcher.site_id,
              node_id: response.entry.id,
              remote_folder_path: response.entry.path.name,
              file_name: path.basename(filePath),
              file_path: _path.toUnix(filePath),
              local_folder_path: path.dirname(destinationPath),
              file_update_at: mtime,
              last_uploaded_at: _base.getCurrentTime(),
              last_downloaded_at: 0,
              is_folder: true,
              is_file: false,
              download_in_progress: 0,
              upload_in_progress: 0,
            });

            // Add an event log
            await eventLogModel.create({
              account_id: account.id,
              type: eventType.UPLOAD_FOLDER,
              description: `Uploaded Folder: ${filePath} to ${account.instance_url}`
            });
          });
        }, 0);

        return response.entry.id;
      }
    } catch (error) {
      // Ignore "duplicate" status codes
      if (error.statusCode == 409) {
        // In case of duplicate error, we will update the file modified date to the db so that it does not try to update next time
        await nodeModel.update({
          file_update_at: _base.getFileModifiedTime(filePath)
        }, {
            account_id: account.id,
            file_path: filePath
          });
      } else {
        // Add an error log
        errorLogAdd(account.id, error, `${__filename}/upload Directory`);
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
      await nodeModel.create({
        account_id: account.id,
        site_id: watcher.site_id,
        node_id: '',
        remote_folder_path: '',
        file_name: path.basename(filePath),
        file_path: _path.toUnix(filePath),
        local_folder_path: path.dirname(filePath),
        file_update_at: 0,
        last_uploaded_at: 0,
        last_downloaded_at: 0,
        is_folder: false,
        is_file: true,
        download_in_progress: 0,
        upload_in_progress: 1,
      });

    } catch (error) {
      // Add an error log
      errorLogAdd(account.id, error, `${__filename}/upload file`);
    }

    request(options)
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

        await nodeModel.update({
          upload_in_progress: 0,
          file_update_at: _base.convertToUTC(response.entry.modifiedAt),
          node_id: response.entry.id,
          remote_folder_path: response.entry.path.name,
          last_uploaded_at: _base.getCurrentTime()
        }, {
            account_id: account.id,
            file_path: filePath
          });

        // Add an event log
        await eventLogModel.create({
          account_id: account.id,
          type: eventType.UPLOAD_FILE,
          description: `Uploaded File: ${filePath} to ${account.instance_url}`
        });
      })
      .catch(async (error) => {
        // Ignore "duplicate" status codes
        if (error.statusCode == 409) {
          // In case of duplicate error, we will update the file modified date to the db so that it does not try to update next time
          await nodeModel.update({
            file_update_at: _base.getFileModifiedTime(filePath)
          }, {
              account_id: account.id,
              file_path: filePath
            });
        }
        try {
          // If the file could be uploaded for some reason, we will delete the record so that the uploader can reintiate the transfer later
          await nodeModel.destroy({
            where: {
              account_id: account.id,
              file_path: filePath
            }
          });
        } catch (error) {
          console.log('Cannot forceDeleteByPath', filePath);
        }
      })
  }

  return;
};