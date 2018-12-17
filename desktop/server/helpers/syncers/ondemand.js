"use strict";
const Sequelize = require("sequelize");
const fs = require("fs-extra");
const path = require("path");
const mkdirp = require("mkdirp");
const glob = require("glob");
const { nodeModel } = require("../../models/node");
const { add: errorLogAdd } = require("../../models/log-error");
const remote = require("../remote");
const _base = require("./_base");
const _path = require("../path");
const rimraf = require('rimraf');
const emitter = require('../emitter').emitter;

// Logger
const { logger } = require("../logger");

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
  const account = params.account;
  const watcher = params.watcher;
  const sourceNodeId = params.sourceNodeId; // the nodeid to download
  const destinationPath = params.destinationPath; // where on local to download
  const recursive = params.recursive || false;

  logger.info("download step 1");

  if (
    account.sync_enabled == false || (recursive === false && account.download_in_progress == true)) {
    logger.info("download bailed");
    return;
  }

  logger.info("download step 2");

  let children = await remote.getChildren({
    account,
    parentNodeId: sourceNodeId,
    maxItems: 150000
  });
  logger.info("download step 3");

  if (!children) {
    return;
  }

  // If the current folder does not exists, we will create it.
  if (!fs.existsSync(`${destinationPath}/${watcher.site_name}/documentLibrary`)) {
    mkdirp(`${destinationPath}/${watcher.site_name}/documentLibrary`);
  }

  logger.info("download step 4");

  for (const iterator of children.list.entries) {
    const node = iterator.entry;
    let relevantPath = node.path.name.substring(
      node.path.name.indexOf(`${watcher.site_name}/documentLibrary`)
    );

    let fileRenamed = false; // If a node is renamed on server, we will not run this delete node check immediately
    const currentPath = path.join(destinationPath, relevantPath, node.name);

    logger.info("download step 5");

    // Check if the node is present in the database
    let recordData = await nodeModel.findOne({
      where: {
        account_id: account.id,
        node_id: node.id
      }
    });

    let { dataValues: record } = { ...recordData };
    logger.info("download step 6");

    if (record && (record.download_in_progress === true || record.upload_in_progress === true)) {
      logger.info("Bailed download, upload in progress");
      continue;
    }

    logger.info("download step 6-1");

    // Possible cases...
    // Case A: Perhaps the file was RENAMED on server. Delete from local
    // Case B: Check last modified date and download if newer
    // Case C: Perhaps the file was DELETED on local but not on the server.
    // Case D: If not present on local, download...

    // If the record is present
    if (record) {

      // Case A: Perhaps the file was RENAMED on server. Delete from local
      if (record.file_name !== node.name) {
        logger.info("Deleted renamed (old) path..." + record.file_path);
        // If a node/folder is renamed on server, we will skip the deletion logic in this iteration assuming that the download will take sometime
        fileRenamed = true;
        // Delete the old file/folder from local
        fs.remove(record.file_path);

        // Delete the record from the DB
        if (record.is_file === true) {
          await nodeModel.destroy({
            where: {
              account_id: account.id,
              node_id: record.node_id
            }
          });
        } else if (record.is_folder === true) {
          // Delete all records that are relavant to the file/folder path
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
      } // end Case A

      // Case B: ...check last modified date and download the file if newer (lets not download any folders)
      // Convert the time to UTC and then get the unixtimestamp.
      else if (
        fs.existsSync(currentPath) &&
        _base.convertToUTC(node.modifiedAt) > _base.getFileModifiedTime(record.file_path) &&
        record.file_name === path.basename(currentPath) &&
        record.is_file === true
      ) {
        logger.info("downloaded since new " + currentPath);
        await _createItemOnLocal({
          watcher,
          node,
          currentPath,
          account
        });
      } // end Case B


      // Case C: Perhaps the file was DELETED on local but not on the server.(will skip if the node was renamed on server)
      else if (
        !fs.existsSync(currentPath) &&
        record.node_id === node.id &&
        record.remote_folder_path === node.path.name && // making sure the file was not moved to another location
        fileRenamed === false
      ) {
        logger.info(
          "deleted on server, because deleted on local" + currentPath
        );
        await remote.deleteServerNode({
          account,
          record
        });
      } // end Case C
    }

    // Case D: If not present on local or if the file is not present on local, download...
    if (!record && fileRenamed === false) {
      await _createItemOnLocal({
        watcher,
        node,
        currentPath,
        account
      });
    }

    if (node.isFolder === true) {
      await exports.recursiveDownload({
        account,
        watcher,
        sourceNodeId: node.id,
        destinationPath,
        recursive: true
      });
    }

    logger.info("download step 7");
  }

  if (children.list.pagination.hasMoreItems === false && recursive === false) {
    logger.info("FINISH DOWNLOADING...");
    // await accountModel.syncComplete(account.id);
    return;
  }
};

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  syncPath: string,
 *  rootNodeId: string,
 * }
 */
var counter = 0;
exports.recursiveUpload = async params => {
  const account = params.account;
  const watcher = params.watcher;
  let rootFolder = params.rootFolder;

  logger.info("upload step 1");

  if (account.sync_enabled == 0 || account.upload_in_progress == 1) {
    logger.info("upload bailed");
    return;
  }

  logger.info("upload step 2");

  // Following cases are possible...
  // Case A: File created or renamed on local, upload it
  // Case B: File modified on local, upload it
  // Case C: File deleted on server, delete on local
  glob.sync(rootFolder).map(async filePath => {
    logger.info("upload step 3 " + filePath);

    if (counter >= 50) {
      logger.info("Going to sleep for 30 seconds");
      console.log('"Going to sleep for 30 seconds"', counter);

      counter = 0;
      await _base.sleep(30000);
    }

    let localFileModifiedDate = _base.getFileModifiedTime(filePath);

    // Get the DB record of the filePath
    let nodeData = await nodeModel.findOne({
      where: {
        account_id: account.id,
        file_path: filePath
      }
    });
    const { dataValues: record } = { ...nodeData };
    logger.info("upload step 4");

    if (record && (record.download_in_progress == 1 || record.upload_in_progress == 1)) {
      logger.info("Bailed upload, download in progress. " + filePath);
      return;
    }

    // Case A: File created or renamed on local, upload it
    if (!record) {
      counter++;
      logger.info("New file, uploading... > " + filePath);
      await remote.upload({
        account,
        watcher,
        filePath,
        rootNodeId: watcher.document_library_node
      });
    }

    logger.info("upload step 5");

    // If the record exists in the DB (making sure upload is not in progress)
    if (record) {
      logger.info("upload step 6");

      // Listen to the event
      emitter.once('getNode' + record.node_id, async data => {

        // Case B: File modified on local, upload it
        if (data.statusCode === 200 && data.record.is_file === true && localFileModifiedDate > _base.convertToUTC(data.response.entry.modifiedAt)) {
          logger.info("File modified on local, uploading..." + filePath);
          // Upload the local changes to the server.
          counter++;
          await remote.upload({
            account,
            watcher,
            filePath,
            rootNodeId: watcher.document_library_node
          });
        }

        // Case C: File deleted on server? delete on local
        if (data && data.statusCode === 404 && data.record.download_in_progress == false && data.record.upload_in_progress == false) {
          logger.info(
            "Node not available on server, deleting on local: " + data.record.file_path + " - " + data.record.id
          );
          // If the node is not found on the server, delete the file on local
          rimraf(data.record.file_path, async () => {
            await nodeModel.destroy({
              where: {
                account_id: data.account.id,
                node_id: data.record.node_id
              }
            });
          });
        }

        // OR if the node exists on server but that path of node does not match the one with local file path, then delete it from local (possible the file was moved to a different location)
        if (data.statusCode === 200 && data.response.entry && data.response.entry.path.name !== data.record.remote_folder_path) {
          logger.info(
            "Node was moved to some other location, deleting on local: " + data.record.file_path + " - " + data.record.id
          );

          rimraf(data.record.file_path, async () => {
            await nodeModel.destroy({
              where: {
                account_id: data.account.id,
                file_path: data.record.file_path
              }
            });
          });
        }

      }); // end event listener

      counter++;
      // Make a request to the server to get the node details
      await remote.getNode({
        account,
        record
      });
      logger.info("upload step 7");
    }

    logger.info("upload step 8");

    if (fs.statSync(filePath).isDirectory()) {
      logger.info("upload step 9");
      exports.recursiveUpload({
        account,
        watcher,
        rootFolder: filePath + '/*'
      });
    }

    logger.info("upload step 10");
  }); // Filelist iteration end

  logger.info("upload step 11");
  return;
}

var _createItemOnLocal = async params => {
  const account = params.account;
  const watcher = params.watcher;
  const node = params.node;
  const currentPath = params.currentPath;
  try {
    if (node.isFolder === true) {
      // If the child is a folder, create the folder first
      if (!fs.existsSync(currentPath)) {
        mkdirp.sync(currentPath);
      }

      // Delete if record already exists
      await nodeModel.destroy({
        where: {
          account_id: account.id,
          site_id: watcher.site_id,
          node_id: node.id,
          file_path: _path.toUnix(currentPath),
        }
      });

      // Add reference to the nodes table
      await nodeModel.create({
        account_id: account.id,
        site_id: watcher.site_id,
        node_id: node.id,
        remote_folder_path: node.path.name,
        file_name: path.basename(currentPath),
        file_path: _path.toUnix(currentPath),
        local_folder_path: path.dirname(currentPath),
        file_update_at: _base.convertToUTC(node.modifiedAt),
        last_uploaded_at: 0,
        last_downloaded_at: _base.getCurrentTime(),
        is_folder: true,
        is_file: false,
        download_in_progress: 0,
        upload_in_progress: 0
      });
      return;
    }

    // If the child is a file, download the file...
    if (node.isFile === true) {
      await remote.download({
        watcher,
        account,
        node,
        destinationPath: currentPath,
        remoteFolderPath: node.path.name
      });
    }
  } catch (error) {
    errorLogAdd(account.id, error, `${__filename}/_createItemOnLocal`);
  }
};
