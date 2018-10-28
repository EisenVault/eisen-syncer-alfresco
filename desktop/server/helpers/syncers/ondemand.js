const fs = require("fs-extra");
const path = require("path");
const mkdirp = require("mkdirp");
const glob = require("glob");
const accountModel = require("../../models/account");
const remote = require("../remote");
const nodeModel = require("../../models/node");
const errorLogModel = require("../../models/log-error");
const _base = require("./_base");

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
  let account = params.account;
  let sourceNodeId = params.sourceNodeId; // the nodeid to download
  let destinationPath = params.destinationPath; // where on local to download
  let recursive = params.recursive || false;

  if (account.sync_enabled == 0 || (account.sync_in_progress == 1 && recursive === false)) {
    return;
  }

  // logger.info("step 1");

  let children = await remote.getChildren({
    account,
    parentNodeId: sourceNodeId,
    maxItems: 150000
  });
  // logger.info("step 2");

  if (!children) {
    return;
  }
  // logger.info("step 3");

  await accountModel.syncStart(account.id);
  // logger.info("step 4");

  for (const iterator of children.list.entries) {
    const node = iterator.entry;
    let relevantPath = node.path.name.substring(
      node.path.name.indexOf("documentLibrary")
    );
    let fileRenamed = false; // If a node is renamed on server, we will not run this delete node check immediately
    const currentPath = path.join(destinationPath, relevantPath, node.name);
    // logger.info("step 5");

    // Check if the node is present in the database
    let record = await nodeModel.getOneByNodeId({
      account: account,
      nodeId: node.id
    });
    // logger.info("step 6");

    // Possible cases...
    // Case A: Perhaps the file was RENAMED on server. Delete from local
    // Case B: Check last modified date and download if newer
    // Case C: Perhaps the file was DELETED on local but not on the server.
    // Case D: If not present on local, download...

    // If the record is present
    if (record) {
      // Case A: Perhaps the file was RENAMED on server. Delete from local
      if (record.file_name !== path.basename(currentPath)) {
        logger.info("Deleted renamed (old) path..." + record.file_path);
        // If a node/folder is renamed on server, we will skip the deletion logic in this iteration assuming that the download will take sometime
        fileRenamed = true;
        // Delete the old file/folder from local
        fs.removeSync(record.file_path);

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
      } // end Case A

      // Case B: ...check last modified date and download of the file if newer (lets not download any folders)
      // Convert the time to UTC and then get the unixtimestamp.
      else if (
        _base.convertToUTC(node.modifiedAt) > _base.getFileLatestTime(record) &&
        record.file_name === path.basename(currentPath) &&
        record.is_file === 1
      ) {
        logger.info("downloaded since new " + currentPath);
        await _createItemOnLocal({
          node,
          currentPath,
          account
        });
      } // end Case B

      // Case C: Perhaps the file was DELETED on local but not on the server.(will skip if the node was renamed on server)
      else if (
        !fs.existsSync(currentPath) &&
        record.node_id === node.id &&
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
      logger.info("created" + currentPath);
      await _createItemOnLocal({
        node,
        currentPath,
        account
      });
    }

    if (node.isFolder === true) {
      await exports.recursiveDownload({
        account,
        sourceNodeId: node.id,
        destinationPath,
        recursive: true
      });
    }
    // logger.info("step 7");
  }

  if (children.list.pagination.hasMoreItems === false && recursive === false) {
    logger.info("FINISH DOWNLOADING...");
    await accountModel.syncComplete(account.id);
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
exports.recursiveUpload = async params => {
  let account = params.account;
  let rootNodeId = params.rootNodeId; // This should be the documentLibrary nodeId

  // logger.info("upload stp" + 1);

  if (account.sync_enabled == 0 || account.sync_in_progress == 1) {
    return;
  }
  // Set the issyncing flag to on so that the client can know if the syncing progress is still going
  await accountModel.syncStart(account.id);

  // Get the folder path as /var/sync/documentLibrary or /var/sync/documentLibrary/watchedFolder
  let rootFolder = path.join(
    account.sync_path,
    account.watch_folder.substring(
      account.watch_folder.indexOf("documentLibrary")
    ),
    "**",
    "*"
  );

  // logger.info("upload stp" + 2);

  // This function will list all files/folders/sub-folders recursively.
  let localFilePathList = glob.sync(rootFolder);
  // logger.info("upload stp" + 5);

  for (let filePath of localFilePathList) {
    // logger.info("upload stp " + 6);
    let localFileModifiedDate  = _base.getFileModifiedTime(filePath);

    // Get the DB record of the filePath
    let record = await nodeModel.getOneByFilePath({
      account: account,
      filePath: filePath
    });

    // logger.info("upload stp " + 7);

    // Case A: File created or renamed on local, upload it
    if (!record) {
      logger.info("New file, uploading..." + filePath);
      await remote.upload({
        account,
        filePath,
        rootNodeId
      });
      continue;
    }

    // Case B: File modified on local, upload it
    else if (
      record &&
      localFileModifiedDate > record.last_uploaded_at &&
      localFileModifiedDate > record.last_downloaded_at &&
      Math.abs( localFileModifiedDate - record.last_downloaded_at ) > 10 && // only upload if file wasnt downloaded in the last 10 seconds
      record.is_file === 1
    ) {
      logger.info("File modified on local, uploading..." + filePath);
      // Upload the local changes to the server.
      await remote.upload({
        account: account,
        filePath: filePath,
        rootNodeId: rootNodeId
      });
      continue;
    }

    // Case C: File deleted on server, delete on local
    else if (
      record &&
      (record.last_uploaded_at > 0 || record.last_downloaded_at > 0)
    ) {
      const isNodeExists = await remote.getNode({
        account,
        nodeId: record.node_id
      });

      // Make sure the node was deleted on the server
      if (!isNodeExists) {
        logger.info(
          "File not available on server, deleting on local..." + filePath
        );
        fs.removeSync(record.file_path);
      }
    }
    // logger.info("upload stp " + 9);
  } // Filelist iteration end
  // logger.info("upload stp " + 10);

  // At the end of folder iteration, we will compile a list of old files that were renamed. We will delete those from the server.
  let missingFiles = await nodeModel.getMissingFiles({
    account,
    fileList: localFilePathList
  });
  // logger.info("upload stp " + 11);

  for (const record of missingFiles) {
    logger.info("Deleting missing files...");
    remote.deleteServerNode({
      account,
      record
    });
  }
  // logger.info("upload stp " + 12);
  localFilePathList = [];
  missingFiles = null;

  // Set the sync completed time and also set issync flag to off
  await accountModel.syncComplete(account.id);
  logger.info("FINISHED UPLOAD...");
  return;
};

/**
 * Recursively delete all files from server that were deleted from local
 *
 * @param object params
 * {
 *  account: Account<Object>,
 * }
 */
exports.recursiveDelete = async params => {
  return;
  let account = params.account;

  if (account.sync_enabled == 0) {
    return;
  }

  // Start the sync
  await accountModel.syncStart(account.id);

  // This function will list all files/folders/sub-folders recursively.
  let localFilePathList = glob.sync(path.join(account.sync_path, "**", "*"));

  let missingFiles = await nodeModel.getMissingFiles({
    account: account,
    fileList: localFilePathList
  });

  for (const iterator of missingFiles) {
    // Delete the node from the server, once thats done it will delete the record from the DB as well
    await remote.deleteServerNode({
      account: account,
      deletedNodeId: iterator.node_id
    });
    logger.info(`Deleted missing file: ${iterator.stringify()}`);
  }

  // Set the sync completed time and also set issync flag to off
  await accountModel.syncComplete(account.id);
};

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  filePath: string,
 * }
 */
exports.deleteByPath = async params => {
  let account = params.account;
  let filePath = params.filePath;

  if (
    account.sync_enabled == 0 ||
    (await remote.watchFolderGuard({ account, filePath })) === false
  ) {
    return;
  }

  try {
    // Start the sync
    await accountModel.syncStart(account.id);

    let records = await nodeModel.getAllByFileOrFolderPath({
      account: account,
      path: filePath
    });

    for (let record of records) {
      // Delete the node from the server, once thats done it will delete the record from the DB as well
      await remote.deleteServerNode({
        account: account,
        record: record
      });
    }
    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);
  } catch (error) {
    logger.error(`Error Message : ${JSON.stringify(error)}`);
    await errorLogModel.add(account.id, error);
    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);
  }
};

_createItemOnLocal = async params => {
  let account = params.account;
  let node = params.node;
  let currentPath = params.currentPath;
  try {
    if (node.isFolder === true) {
      // if (await remote.watchFolderGuard({
      //   account,
      //   filePath: currentPath,
      //   node: node,
      //   action: 'DOWNLOAD'
      // }) === false) {
      //   return;
      // }

      // If the child is a folder, create the folder first
      if (!fs.existsSync(currentPath)) {
        mkdirp.sync(currentPath);
      }

      // Add reference to the nodes table
      await nodeModel.add({
        account: account,
        nodeId: node.id,
        remoteFolderPath: path.dirname(node.path.name),
        filePath: currentPath,
        fileUpdateAt: _base.convertToUTC(node.modifiedAt),
        lastDownloadedAt: _base.getCurrentTime(),
        isFolder: true,
        isFile: false
      });
    }

    // If the child is a file, download the file...
    if (node.isFile === true) {
      await remote.download({
        account,
        node,
        destinationPath: currentPath,
        remoteFolderPath: path.dirname(node.path.name)
      });
    }
  } catch (error) {
    logger.error(`Error Message : ${JSON.stringify(error)}`);
    await errorLogModel.add(account.id, error);
  }
};
