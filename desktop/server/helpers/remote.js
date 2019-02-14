"use strict";
const Sequelize = require("sequelize");
const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const request = require("request-promise-native");
const requestNative = require("request");
const { add: errorLogAdd } = require("../models/log-error");
const { eventLogModel, types: eventType } = require("../models/log-event");
const { nodeModel } = require("../models/node");
const token = require("./token");
const _base = require("./syncers/_base");
const Utimes = require('@ronomon/utimes');
const _path = require('./path');

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
    throw new Error("Record must have a node_id");
  }

  var options = {
    method: "GET",
    pool: { maxSockets: 1 },
    resolveWithFullResponse: true,
    url: `${account.instance_url}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${record.node_id}?include=path`,
    headers: {
      Connection: "keep-alive",
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    return await request(options);
  } catch (error) {
    errorLogAdd(account.id, error, `${__filename}/getNode/${record.node_id}`);
    try {
      error = JSON.parse(error.error);
      return error.error;
    } catch (error) {
      return {}
    }
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
  let maxItems = params.maxItems || 1;
  let skipCount = params.skipCount || 0;

  if (!account) {
    throw new Error("Account not found");
  }

  if (!parentNodeId) {
    throw new Error("parentNodeId is mandatory");
  }

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      parentNodeId +
      "/children?include=path&skipCount=" + skipCount + "&maxItems=" +
      maxItems,
    headers: {
      Connection: "keep-alive",
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    let response = await request(options)
      .on('error', function (e) {
        console.error('######ON ERROR#####', e);
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

  if (!account || !record) {
    return;
  }

  var options = {
    method: "DELETE",
    pool: { maxSockets: 1 },
    resolveWithFullResponse: true,
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
        console.error('error on response', e);
        return;
      });

    if (response.statusCode == 204) {
      // Delete the record from the DB
      if (record.is_file === true) {
        await nodeModel.destroy({
          where: {
            account_id: account.id,
            node_id: record.node_id
          }
        });
      } else if (record.is_folder === true) {
        await nodeModel.destroy({
          where: {
            account_id: account.id,
            [Sequelize.Op.or]: [
              {
                file_path: {
                  [Sequelize.Op.like]: record.file_path + "%"
                }
              },
              {
                local_folder_path: record.file_path
              }
            ]
          }
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
      errorLogAdd(account.id, error, `${__filename}/deleteServerNode`);
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

  const customData = {
    destinationPath,
    remoteFolderPath,
    account: {
      id: account.id,
      instance_url: account.instance_url
    },
    node: {
      id: node.id,
      createdAt: node.createdAt,
      modifiedAt: node.modifiedAt,
    },
    watcher: {
      site_id: watcher.site_id
    }
  };

  var options = {
    method: "GET",
    pool: { maxSockets: 1 },
    url: `${account.instance_url}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${node.id}/content?attachment=true&customData=${encodeURIComponent(JSON.stringify(customData))}`,
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

    try {
      // Add reference to the nodes table
      await nodeModel.upsert({
        account_id: account.id,
        site_id: watcher.site_id,
        node_id: node.id,
        remote_folder_path: remoteFolderPath,
        file_name: path.basename(destinationPath),
        file_path: _path.toUnix(destinationPath),
        local_folder_path: path.dirname(destinationPath),
        file_update_at: 0,
        last_uploaded_at: 0,
        last_downloaded_at: _base.getCurrentTime(),
        is_folder: false,
        is_file: true,
        download_in_progress: true,
        upload_in_progress: false
      }, {
          account_id: account.id,
          site_id: watcher.site_id,
          node_id: node.id
        });
    } catch (error) { }

    let totalBytes = 0;
    let recievedSize = 0;
    await requestNative(options)
      .on('response', function (response) {
        totalBytes = response.headers['content-length'];
        response.on('data', async function (data) {
          // compressed data as it is received
          recievedSize += data.length;

          if (response.statusCode === 200 && recievedSize >= totalBytes) {
            const uri = response.req.path.split('customData=')[1];
            await _base.deferFileUpdate(uri);
            return;
          }
        })
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
exports.upload = async (params, callback) => {
  let account = params.account;
  let watcher = params.watcher;
  let filePath = params.filePath;
  let rootNodeId = params.rootNodeId;
  let overwrite = params.overwrite || "true";
  let isNewFile = params.isNewFile || false;
  let options = {};

  if (!account) {
    throw new Error("Account not found");
  }

  let statSync = null;
  try {
    statSync = fs.statSync(filePath);
  } catch (error) {
    errorLogAdd(account.id, error, `${__filename}/upload_statSync`);
    return;
  }

  // If its a directory, send a request to create the directory.
  if (fs.existsSync(filePath) && statSync.isDirectory()) {
    let directoryName = path.basename(params.filePath);
    let relativePath = path.dirname(filePath).split('documentLibrary')[1];

    relativePath = relativePath.replace(/^\/|\/$/g, '');

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
      await nodeModel.insert({
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
        is_folder: true,
        is_file: false,
        download_in_progress: false,
        upload_in_progress: true,
      });
    } catch (error) { }

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
          Utimes.utimes(`${filePath}`, btime, mtime, atime, () => { });
        }, 0);

        try {
          // Update the record in the db
          await nodeModel.update({
            account_id: account.id,
            site_id: watcher.site_id,
            node_id: response.entry.id,
            remote_folder_path: response.entry.path.name,
            file_name: path.basename(filePath),
            file_path: _path.toUnix(filePath),
            local_folder_path: path.dirname(filePath),
            file_update_at: mtime,
            last_uploaded_at: _base.getCurrentTime(),
            last_downloaded_at: 0,
            is_folder: true,
            is_file: false,
            download_in_progress: false,
            upload_in_progress: false,
          }, {
              where: {
                account_id: account.id,
                site_id: watcher.site_id,
                node_id: response.entry.id,
                file_path: _path.toUnix(filePath),
              }
            });
        } catch (error) { }

        // Add an event log
        await eventLogModel.create({
          account_id: account.id,
          type: eventType.UPLOAD_FOLDER,
          description: `Uploaded Folder: ${filePath} to ${account.instance_url}`
        });

        return response.entry.id;
      }
    } catch (error) {
      // Ignore "duplicate" status codes
      if (error.statusCode == 409) {
        // In case of duplicate error, we will update the file modified date to the db so that it does not try to update next time
        await nodeModel.update({
          file_update_at: _base.getFileModifiedTime(filePath)
        }, {
            where: {
              account_id: account.id,
              file_path: filePath
            }
          });
      } else {
        // Add an error log
        errorLogAdd(account.id, error, `${__filename}/upload Directory`);
      }
    }

    return false;
  }

  // If its a file, send a request to upload the file.
  if (fs.existsSync(filePath) && statSync.isFile()) {
    const split = path.dirname(filePath).split('documentLibrary');

    if (typeof split[1] === 'undefined') {
      return;
    }

    // Get the path after documentLibrary
    let relativePath = split[1].replace(/^\/|\/$/g, '');

    options = {
      pool: { maxSockets: 1 },
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
        overwrite
      }
    };

    try {

      if (isNewFile) {
        await nodeModel.create({
          account_id: account.id,
          site_id: watcher.site_id,
          file_name: path.basename(filePath),
          file_path: _path.toUnix(filePath),
          local_folder_path: path.dirname(filePath),
          last_uploaded_at: _base.getCurrentTime(),
          is_folder: false,
          is_file: true,
          download_in_progress: false,
          upload_in_progress: true,
        });
      } else {
        await nodeModel.update({
          last_uploaded_at: _base.getCurrentTime(),
          download_in_progress: false,
          upload_in_progress: true,
        }, {
            where: {
              account_id: account.id,
              site_id: watcher.site_id,
              file_path: _path.toUnix(filePath)
            }
          });
      }

    } catch (error) { console.log(error) }

    try {
      requestNative(options, async (error, response, body) => {

        if (error) {
          console.log('remote.upload', error);
        }

        if (!error && response.statusCode == 201) {
          var node = JSON.parse(body);

          // Update the time meta properties of the downloaded file
          const btime = _base.convertToUTC(node.entry.createdAt);
          const mtime = _base.convertToUTC(node.entry.modifiedAt);
          const atime = undefined;

          _base.deferFileModifiedDate({
            filePath, btime, mtime, atime
          }, 2000, async () => {

            // File date modification done, lets update record
            // Update the record in the db
            try {
              await nodeModel.update({
                account_id: account.id,
                site_id: watcher.site_id,
                node_id: node.entry.id,
                remote_folder_path: node.entry.path.name,
                file_name: path.basename(filePath),
                file_path: _path.toUnix(filePath),
                local_folder_path: path.dirname(filePath),
                file_update_at: _base.convertToUTC(node.entry.modifiedAt),
                last_uploaded_at: _base.getCurrentTime(),
                last_downloaded_at: 0,
                is_folder: false,
                is_file: true,
                download_in_progress: false,
                upload_in_progress: false,
              }, {
                  where: {
                    account_id: account.id,
                    site_id: watcher.site_id,
                    file_path: _path.toUnix(filePath),
                  }
                });
            } catch (error) { }

            console.log(`Done uploading file: ${filePath} to ${account.instance_url}`);

            try {
              // Add an event log
              await eventLogModel.create({
                account_id: account.id,
                type: eventType.UPLOAD_FILE,
                description: `Uploaded File: ${filePath} to ${account.instance_url}`
              });
            } catch (error) { }

            // Completed upload, run the callback
            callback(true);
          });

        }

      });
    } catch (error) {
      // Add an error log
      errorLogAdd(account.id, error, `${__filename}/upload file`);
    }
  }
  return;
};