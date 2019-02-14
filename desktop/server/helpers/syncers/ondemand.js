"use strict";
const Sequelize = require("sequelize");
const fs = require("fs-extra");
const path = require("path");
const mkdirp = require("mkdirp");
const glob = require("glob");
const { nodeModel } = require("../../models/node");
const { workerModel } = require("../../models/worker");
const { settingModel } = require("../../models/setting");
const { add: errorLogAdd } = require("../../models/log-error");
const remote = require("../remote");
const _base = require("./_base");

// Logger
const { logger } = require("../logger");

const nodeMap = new Map();
exports.recursiveDownload = async params => {
  const account = params.account;
  const watcher = params.watcher;
  const sourceNodeId = params.sourceNodeId; // the nodeid to download
  const destinationPath = params.destinationPath; // where on local to download
  let skipCount = params.skipCount || 0;

  const setting = await settingModel.findOne({
    where: {
      name: 'SYNC_PAUSE_SECONDS'
    }
  });

  // Sleep for sometime
  await _base.sleep(Number(setting.value) * 1000);

  let children = await remote.getChildren({
    account,
    parentNodeId: sourceNodeId,
    skipCount,
    maxItems: 1
  });

  // Finished iterating all nodes and its children
  if (watcher.watch_node === sourceNodeId && children.list.entries.length === 0) {
    return;
  }

  // If a folder does not have any sub-files/sub-folders, go to its parent folder.
  if (!children || children.list.entries.length === 0) {
    if (nodeMap.has(sourceNodeId)) {
      const getMapData = nodeMap.get(sourceNodeId);
      const parentId = getMapData.parentId;
      const skipCount = getMapData.skipCount + 1;
      return await exports.recursiveDownload({
        account,
        watcher,
        sourceNodeId: parentId,
        destinationPath,
        skipCount
      });
    }
    return await exports.recursiveDownload({
      account,
      watcher,
      sourceNodeId,
      destinationPath,
      skipCount
    });
  }

  const node = children.list.entries[0].entry;

  // If iteration of all children is complete, go to its parent folder
  if (children.list.pagination.hasMoreItems === false) {

    if (nodeMap.has(node.parentId)) {
      const getMapData = nodeMap.get(node.parentId);
      const parentId = getMapData.parentId;
      const skipCount = getMapData.skipCount + 1;

      // Download the node
      await exports._processDownload({
        node,
        account,
        watcher,
        sourceNodeId,
        destinationPath
      });

      return await exports.recursiveDownload({
        account,
        watcher,
        sourceNodeId: parentId,
        destinationPath,
        skipCount
      });
    }
  }

  if (node.isFolder) {
    // In case of folder, save the skipcount of the current folder
    nodeMap.set(node.id, {
      parentId: node.parentId,
      skipCount
    });

    // Download the folder
    await exports._processDownload({
      node,
      account,
      watcher,
      sourceNodeId,
      destinationPath
    });

    return await exports.recursiveDownload({
      account,
      watcher,
      sourceNodeId: node.id,
      destinationPath,
      skipCount: 0
    });

  } else if (node.isFile) {

    // Download the file
    await exports._processDownload({
      node,
      account,
      watcher,
      sourceNodeId,
      destinationPath
    });

    return await exports.recursiveDownload({
      account,
      watcher,
      sourceNodeId: node.parentId,
      destinationPath,
      skipCount: ++skipCount
    });
  }
}

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  sourceNodeId: <String>,
 *  destinationPath: <String>,
 * }
 */
exports._processDownload = async params => {
  const node = params.node;
  const account = params.account;
  const watcher = params.watcher;
  const destinationPath = params.destinationPath; // where on local to download

  logger.info("_processDownload Started");

  if (
    account.sync_enabled == false) {
    logger.info("download bailed");
    return;
  }

  // If the current folder does not exists, we will create it.
  if (!fs.existsSync(`${destinationPath}/${watcher.site_name}/documentLibrary`)) {
    mkdirp(`${destinationPath}/${watcher.site_name}/documentLibrary`);
  }

  let relevantPath = node.path.name.substring(
    node.path.name.indexOf(`${watcher.site_name}/documentLibrary`)
  );

  let fileRenamed = false; // If a node is renamed on server, we will not run this delete node check immediately
  const currentPath = path.join(destinationPath, relevantPath, node.name);

  // Check if the node is present in the database
  let recordData = await nodeModel.findOne({
    where: {
      account_id: account.id,
      node_id: node.id
    }
  });

  let { dataValues: record } = { ...recordData };

  if (record && record.download_in_progress === true) {
    // If the file is stalled, we will change its modified date to a backdated date
    if (await _base.isStalledDownload(record) === true) {
      const btime = 395114400000; // Saturday, July 10, 1982 7:30:00 AM
      const mtime = btime;
      const atime = btime;
      _base.deferFileModifiedDate({
        filePath: record.file_path,
        btime,
        mtime,
        atime
      }, 2000,
        async (done) => {
          if (done === true) {
            await nodeModel.update({
              download_in_progress: false
            }, {
                where: {
                  id: record.id
                }
              });
          }
        });
    }

    logger.info("Bailed download, already in progress");
    return;
  }

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
      await _base.createItemOnLocal({
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
    await _base.createItemOnLocal({
      watcher,
      node,
      currentPath,
      account
    });
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
exports.recursiveUpload = async params => {
  const account = params.account;
  const watcher = params.watcher;
  let rootFolder = params.rootFolder;

  if (account.sync_enabled === false) {
    logger.info("upload bailed");
    return;
  }

  glob.sync(rootFolder).forEach(async filePath => {

    if (path.basename(filePath) == 'documentLibrary') {
      return;
    }

    try {
      await workerModel.create({
        account_id: account.id,
        watcher_id: watcher.id,
        file_path: filePath,
        root_node_id: watcher.document_library_node,
        priority: 0
      });
    } catch (error) {
      // Log only if its not a unique constraint error.
      if (error.parent.errno !== 19) {
        console.log('error', error);
      }
    }

    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        exports.recursiveUpload({
          account,
          watcher,
          rootFolder: filePath + '/*'
        });
      }
    } catch (error) {
      errorLogAdd(account.id, error, `${__filename}/recursiveUpload`);
      return;
    }
  }); // Filelist iteration end

  return;
}

