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

  if (account.sync_enabled == 0) {
    return;
  }

  try {
    // Start the sync
    await accountModel.syncStart(account.id);

    let response;
    let availableNodeList = [];
    let skipCount = 0;
    let maxItems = 100;

    while (true) {
      response = await remote.getNodeList({
        account: account,
        nodeId: sourceNodeId,
        skipCount: skipCount,
        maxItems: maxItems
      });

      if (!response) {
        // Looks like there are no data available, lets break
        break;
      }

      // Increase the skipcount
      skipCount = skipCount + maxItems;

      for (const node of response.nodes) {
        // Store the node ids so that we can compare it with the db and delete the records on local that are deleted on the server.
        availableNodeList.push(node.id);

        let record = await nodeModel.getOneByNodeId({
          account: account,
          nodeId: node.id
        });

        const nodePathName = node.path_name.split("documentLibrary/")[1];
        let currentPath = `${destinationPath}/${nodePathName}`;

        // Case 1.0: Check If the remote node is NOT present on local. Following scenarios are possible
        // Scenario 1: perhaps new file was created on server.
        // Scenario 2: perhaps the file was renamed on server.
        // Scenario 3: perhaps the file was deleted on local but not on the server.

        if (!fs.existsSync(currentPath)) {
          // Handle scenario 1. Perhaps new file was created on server.
          if (!record) {
            // Looks like the file was CREATED on server, we should download it then...
            await _createItemOnLocal({
              node: node,
              currentPath: currentPath,
              account: account
            });
            continue;
          }

          // Handle Scenario 2: perhaps the file was RENAMED on server.
          if (record && record.file_name !== path.basename(currentPath)) {
            // Delete the old file from local
            logger.info(
              `RENAMED on local: record: ${
                record.file_path
              } basename: ${path.basename(currentPath)}`
            );

            if (record.is_file === 1) {
              fs.removeSync(record.file_path);

              // Delete Old record from DB and update DB and set new filename
              await nodeModel.delete({
                account: account,
                nodeId: node.id
              });

              // Download the renamed file now...
              await _createItemOnLocal({
                node: node,
                currentPath: currentPath,
                account: account
              });
            }else {
              // Download the entire folder
              await exports.recursiveDownload({
                account,
                sourceNodeId: node.id,
                destinationPath: ''
              });
            }

            continue;
          }

          // Handle Scenario 3: perhaps the file was DELETED on local but not on the server.
          if (record && record.node_id === node.id) {
            logger.info(
              `DELETED on server: record: ${record.node_id} ... node.id: ${
                node.id
              } ... ${currentPath}`
            );

            await remote.deleteServerNode({
              account,
              deletedNodeId: record.node_id
            });
            continue;
          }
        }

        // Case 2: File present on local
        if (fs.existsSync(currentPath)) {
          if (record) {
            // Convert the time to UTC and then get the unixtimestamp.
            let nodeModifiedDate = _base.convertToUTC(node.modified_at);
            let fileModifiedDate = _base.getFileLatestTime(record);

            // If the server file time is greater, download the remote file (since server node is newer version)
            if (nodeModifiedDate > fileModifiedDate) {
              await _createItemOnLocal({
                node: node,
                currentPath: currentPath,
                account: account
              });
              continue;
            }
          }
        }
      } // End forloop

      if (response.metadata.hasMoreItems === false) {
        break; // End while loop
      }
    }

    availableNodeList = [];
    await accountModel.syncComplete(account.id);
  } catch (error) {
    logger.error(`Error Message : ${JSON.stringify(error)}`);
    await errorLogModel.add(account.id, error);
    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);
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
  let syncPath = params.sync_path || account.sync_path;
  let rootNodeId = params.rootNodeId;

  if (account.sync_enabled == 0) {
    return;
  }

  rootFolder = syncPath;
  // Check if the path is a folder, if so we will list all file/folders under it.
  if (fs.statSync(rootFolder).isDirectory()) {
    rootFolder = syncPath + "/**/*";
  }

  // Set the issyncing flag to on so that the client can know if the syncing progress is still going
  await accountModel.syncStart(account.id);

  // This function will list all files/folders/sub-folders recursively.
  let localFilePathList = glob.sync(rootFolder);

  // If the main folder is a directory, prepend its path to the list so that the main folder is also added in the "nodes" folder
  if (
    params.sync_path &&
    fs.existsSync(params.sync_path) &&
    fs.statSync(params.sync_path).isDirectory()
  ) {
    localFilePathList.unshift(params.sync_path);
  }

  let counter = 0;
  // Iterate through each file and perform certain task
  for (let filePath of localFilePathList) {
    counter++;
    // Get the DB record of the filePath
    let record = await nodeModel.getOneByFilePath({
      account: account,
      filePath: filePath
    });

    // CASE 1: Check if file is available on disk but missing in DB (New node was created).
    // Then Upload the Node to the server and once response received add a record of the same in the "nodes" table.
    if (!record) {
      await remote.upload({
        account: account,
        filePath: filePath,
        rootNodeId: rootNodeId
      });
      continue;
    }

    // CASE 2: Check if file is available on disk but its modified date does not match the one in DB (file was localy updated/modified)
    // Upload the file to the server and once response received update the "file_modified_at" field in the "nodes" table.
    fileModifiedTime = _base.getFileModifiedTime(filePath);
    // if (record && Math.abs(fileModifiedTime - record.last_uploaded_at) >= 2) {
    if (record && fileModifiedTime > record.last_uploaded_at) {
      // Upload the local changes to the server.
      await remote.upload({
        account: account,
        filePath: filePath,
        rootNodeId: rootNodeId
      });
      continue;
    }

    // CASE 3: File was deleted from the server, but not deleted from local
    if (
      record &&
      (record.last_uploaded_at > 0 || record.last_downloaded_at > 0)
    ) {
      const isNodeExists = await remote.getNode({
        account,
        nodeId: record.node_id
      });

      if (!isNodeExists) {
        logger.info(`Removed from local ${record.file_path}`);
        fs.removeSync(record.file_path);
      }
    }
  } // Filelist iteration end

  if (counter === localFilePathList.length) {
    localFilePathList = [];
    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);
  }
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
  let localFilePathList = glob.sync(account.sync_path + "/**/*");

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
        deletedNodeId: record.node_id
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
    if (node.is_folder === true) {
      // If the child is a folder, create the folder first
      if (!fs.existsSync(currentPath)) {
        mkdirp.sync(currentPath);
      }

      // Add reference to the nodes table
      await nodeModel.add({
        account: account,
        nodeId: node.id,
        remoteFolderPath: path.dirname(node.path_name),
        filePath: currentPath,
        fileUpdateAt: _base.convertToUTC(node.modified_at),
        lastDownloadedAt: _base.getCurrentTime(),
        isFolder: true,
        isFile: false
      });
    }

    // If the child is a file, download the file...
    if (node.is_file === true) {
      await remote.download({
        account: account,
        sourceNodeId: node.id,
        destinationPath: currentPath,
        remoteFolderPath: path.dirname(node.path_name),
        nodeModifiedAt: node.modified_at
      });
    }
  } catch (error) {
    logger.error(`Error Message : ${JSON.stringify(error)}`);
    await errorLogModel.add(account.id, error);
  }
};
