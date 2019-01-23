"use strict";
const Sequelize = require("sequelize");
const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const request = require("request-promise-native");
const downloader = require("request");
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
    return;
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
    console.log('error.message', error.message);
    errorLogAdd(account.id, error, `${__filename}/getNode/${record.node_id}`);
    error = JSON.parse(error.error);
    return error.error;
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
    account: {
      id: account.id,
      instance_url: account.instance_url
    },
    node: {
      id: node.id,
      createdAt: node.createdAt,
      modifiedAt: node.modifiedAt,
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

    // Delete if record already exists
    await nodeModel.destroy({
      where: {
        account_id: account.id,
        site_id: watcher.site_id,
        node_id: node.id,
        file_path: _path.toUnix(destinationPath),
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

    let totalBytes = 0;
    let recievedSize = 0;
    await downloader(options)
      .on('response', function (response) {
        totalBytes = response.headers['content-length'];
        response.on('data', async function (data) {
          // compressed data as it is received
          recievedSize += data.length;

          if (recievedSize >= totalBytes) {
            if (response.statusCode === 200) {
              const path = response.req.path.split('customData=')[1];
              const { destinationPath, account, node } = JSON.parse(decodeURIComponent(path));

              // Update the time meta properties of the downloaded file
              const btime = _base.convertToUTC(node.createdAt);
              const mtime = _base.convertToUTC(node.modifiedAt);
              const atime = undefined;

              setTimeout(() => {
                Utimes.utimes(`${destinationPath}`, btime, mtime, atime, async (error) => {
                  if (error) {
                    errorLogAdd(account.id, error, `${__filename}/download_utimeerror`);
                  }
                });
              }, 0);

              // set download progress to false
              await nodeModel.update({
                download_in_progress: 0,
                last_downloaded_at: _base.getCurrentTime(),
                file_update_at: mtime
              }, {
                  where: {
                    account_id: account.id,
                    file_path: _path.toUnix(destinationPath)
                  }
                });

              console.log(`Downloaded File: ${destinationPath} from ${account.instance_url}`);

              // Add an event log
              await eventLogModel.create({
                account_id: account.id,
                type: eventType.DOWNLOAD_FILE,
                description: `Downloaded File: ${destinationPath} from ${account.instance_url}`,
              });
            }

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
          Utimes.utimes(`${filePath}`, btime, mtime, atime, () => { });
        }, 0);

        // Delete if record already exists
        await nodeModel.destroy({
          where: {
            account_id: account.id,
            site_id: watcher.site_id,
            node_id: response.entry.id,
            file_path: _path.toUnix(filePath),
          }
        });

        await nodeModel.create({
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
          download_in_progress: 0,
          upload_in_progress: 0,
        });

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
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    let relativePath = path.dirname(filePath).split('documentLibrary')[1].replace(/^\/|\/$/g, '');

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
        overwrite: "true"
      }
    };

    try {
      let response = await request(options)
      response = JSON.parse(response.body);

      // Update the time meta properties of the downloaded file
      const btime = _base.convertToUTC(response.entry.createdAt);
      const mtime = _base.convertToUTC(response.entry.modifiedAt);
      const atime = undefined;

      setTimeout(() => {
        Utimes.utimes(`${filePath}`, btime, mtime, atime, async () => { });
      }, 0); //end setTimeout

      // Add a record in the db
      await nodeModel.create({
        account_id: account.id,
        site_id: watcher.site_id,
        node_id: response.entry.id,
        remote_folder_path: response.entry.path.name,
        file_name: path.basename(filePath),
        file_path: _path.toUnix(filePath),
        local_folder_path: path.dirname(filePath),
        file_update_at: _base.convertToUTC(response.entry.modifiedAt),
        last_uploaded_at: _base.getCurrentTime(),
        last_downloaded_at: 0,
        is_folder: false,
        is_file: true,
        download_in_progress: 0,
        upload_in_progress: 0,
      });

      console.log(`Done uploading file: ${filePath} to ${account.instance_url}`);

      // Add an event log
      await eventLogModel.create({
        account_id: account.id,
        type: eventType.UPLOAD_FILE,
        description: `Uploaded File: ${filePath} to ${account.instance_url}`
      });

      return true;

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
      }

      return false;
    }
  }

  return;
};