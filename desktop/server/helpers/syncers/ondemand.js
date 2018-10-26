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

  console.log('step 1');

  let children = await remote.getChildren({
    account,
    parentNodeId: sourceNodeId,
    maxItems: 150000
  });
  console.log('step 2');

  if (!children) {
    return;
  }
  console.log('step 3');

  await accountModel.syncStart(account.id);
  console.log('step 4');

  for (const iterator of children.list.entries) {
    const node = iterator.entry;
    let relevantPath = node.path.name.substring(node.path.name.indexOf('documentLibrary'));
    const currentPath = `${destinationPath}/${relevantPath}/${node.name}`;
    console.log('step 5');

    let record = await nodeModel.getOneByNodeId({
      account: account,
      nodeId: node.id
    });
    console.log('step 6');


    // Case 1.0: Check If the remote node is NOT present on local. Following scenarios are possible
    // Scenario 1: perhaps new file was created on server.
    // Scenario 2: perhaps the file was renamed on server.
    // Scenario 3: perhaps the file was deleted on local but not on the server.
    if (!fs.existsSync(currentPath)) {
      console.log('step 7');

      // Handle scenario 1. Perhaps new file was created on server.
      if (!record) {
        console.log('step 8');

        // Looks like the file was CREATED on server, we should download it then...
        await _createItemOnLocal({
          node: node,
          currentPath: currentPath,
          account: account
        });
      }
      console.log('step 9');

      // Handle Scenario 2: perhaps the file was RENAMED on server.
      if (record && record.file_name !== path.basename(currentPath)) {
        console.log('step inside rename');

        // Delete the old file from local
        if (record.is_file === 1) {
          logger.info(`Renamed file ${record.file_path}`);
          fs.removeSync(record.file_path);

          // Delete Old record from DB and update DB and set new filename
          await nodeModel.forceDelete({
            account: account,
            nodeId: node.id
          });

          // Download the renamed file now...
          await _createItemOnLocal({
            node: node,
            currentPath: currentPath,
            account: account
          });
        } else if (record.is_folder === 1) {
          logger.info(`Renamed FOLDER ${record.file_path}`);

          // Remove the folder and all its contents
          fs.removeSync(record.file_path);

          // Remove all sub files/folder inside the directory
          await nodeModel.forceDeleteAllByFileOrFolderPath({
            account,
            path: record.file_path
          });

          // Download the entire folder
          await exports.recursiveDownload({
            account,
            sourceNodeId: node.id,
            destinationPath: account.sync_path
          });
        }
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
      }
    }
    console.log('step 10');

    // Case 2: File present on local
    if (fs.existsSync(currentPath)) {
      console.log('step 11');

      if (record) {
        console.log('step 12');

        // Convert the time to UTC and then get the unixtimestamp.
        let nodeModifiedDate = _base.convertToUTC(node.modifiedAt);
        let fileModifiedDate = _base.getFileLatestTime(record);

        // If the server file time is greater, download the remote file (since server node is newer version)
        if (nodeModifiedDate > fileModifiedDate) {
          console.log('step 13');

          await _createItemOnLocal({
            node: node,
            currentPath: currentPath,
            account: account
          });
          continue;
        }
      }
    }

    console.log('step 14');

    if (node.isFolder === true) {
      console.log('step 15');

      exports.recursiveDownload({
        account,
        sourceNodeId: node.id,
        destinationPath
      });
    }

  };
  console.log('step FINISH');

  await accountModel.syncComplete(account.id);
  return;
}

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

  console.log('upload stp', 1);

  if (account.sync_enabled == 0) {
    return;
  }


  console.log('upload stp', 2);



  rootFolder = syncPath;
  // Check if the path is a folder, if so we will list all file/folders under it.
  if (fs.statSync(rootFolder).isDirectory()) {
    rootFolder = syncPath + "/documentLibrary/**/*";
  }
  console.log('upload stp', 3);

  // Set the issyncing flag to on so that the client can know if the syncing progress is still going
  await accountModel.syncStart(account.id);
  console.log('upload stp', 4);

  // This function will list all files/folders/sub-folders recursively.
  let localFilePathList = glob.sync(rootFolder);
  console.log('upload stp', 5);

  // If the main folder is a directory, prepend its path to the list so that the main folder is also added in the "nodes" folder
  if (
    params.sync_path &&
    fs.existsSync(params.sync_path) &&
    fs.statSync(params.sync_path).isDirectory()
  ) {
    localFilePathList.unshift(params.sync_path);
  }
  console.log('upload stp', 6);


  let counter = 0;
  // Iterate through each file and perform certain task
  for (let filePath of localFilePathList) {
    console.log('upload stp', 7);

    counter++;
    // Get the DB record of the filePath
    let record = await nodeModel.getOneByFilePath({
      account: account,
      filePath: filePath
    });
    console.log('upload stp', 8);

    // CASE 1: Check if file is available on disk but missing in DB (New node was created).
    // Then Upload the Node to the server and once response received add a record of the same in the "nodes" table.
    if (!record) {
      console.log('upload filePath', filePath);

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
      console.log('upload stp case3, ', 9);

      const isNodeExists = await remote.getNode({
        account,
        nodeId: record.node_id
      });



      // Make sure the node was deleted on the server
      if (!isNodeExists) {
        console.log('isNodeExists', isNodeExists);

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
    if (node.isFolder === true) {
      console.log('currentPath', currentPath);

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
        remoteFolderPath: path.dirname(node.path.name),
      });
    }
  } catch (error) {
    logger.error(`Error Message : ${JSON.stringify(error)}`);
    await errorLogModel.add(account.id, error);
  }
};
