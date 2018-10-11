const fs = require("fs-extra");
const mkdirp = require("mkdirp");
const glob = require("glob");
const accountModel = require("../../models/account");
const remote = require("../remote");
const nodeModel = require("../../models/node");
const errorLogModel = require("../../models/log-error");
const _base = require("./_base");

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
  let sourceNodeId = params.sourceNodeId;
  let destinationPath = params.destinationPath;

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

      if(!response) {
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

        let currentPath =
          destinationPath + "/" + node.path_name.split("documentLibrary/")[1];

        // Case 1: Check If the remote node is NOT present on local
        if (!fs.existsSync(currentPath)) {
          // Case 1.1 Check File reference is present in DB (perhaps file was renamed on server).
          if (record) {
            // Delete the old file
            fs.removeSync(record.file_path);

            // Delete Old record from DB and update DB and set new filename
            await nodeModel.delete({
              account: account,
              nodeId: node.id
            });
          }

          // Case 1.1/1.2 Download the file/folder on local (this will also add the new records in the DB)
          await _createItemOnLocal({
            node: node,
            currentPath: currentPath,
            account: account,
            sourceNodeId: node.id
          });
        }

        // Case 2: File present on local
        if (fs.existsSync(currentPath)) {
          if (record) {
            // Convert the time to UTC and then get the unixtimestamp.
            let nodeModifiedDate = _base.convertToUTC(node.modified_at);

            // let fileModifiedDate = record.file_update_at;
            let fileModifiedDate = _base.getFileLatestTime(record);

            console.log(
              "nodeModifiedDate,fileModifiedDate",
              nodeModifiedDate,
              node.modified_at,
              fileModifiedDate
            );

            // If the server file time is greater, download the remote file (since server node is newer version)
            if (nodeModifiedDate > fileModifiedDate) {
              await _createItemOnLocal({
                node: node,
                currentPath: currentPath,
                account: account,
                sourceNodeId: node.id
              });

              console.log(
                "Downloading " +
                currentPath +
                " since " +
                new Date(nodeModifiedDate * 1000).toLocaleString() +
                " notequal " +
                new Date(fileModifiedDate * 1000).toLocaleString()
              );
            }
          }
        }
      } // End forloop

      if (response.metadata.hasMoreItems === false) {
        break; // End while loop
      }
    }

    // Case 3: Check if any node was deleted on the server, if so we need to delete the files on the local as well...
    const missingFiles = await nodeModel.getMissingFiles({
      account: account,
      fileList: availableNodeList,
      column: "node_id"
    });

    for (const iterator of missingFiles) {

      // Check if the file on the local is not available on the server, if so lets delete the file on the local.
      if (availableNodeList.indexOf(iterator) === -1) {
        // Delete the file on local that was deleted on the server
        const record = await nodeModel.getOneByNodeId({
          account: account,
          nodeId: iterator
        });
        fs.removeSync(record.file_path);
      }
    }

    await accountModel.syncComplete(account.id);
  } catch (error) {
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
  if (fs.statSync(rootFolder).isDirectory()) {
    rootFolder = syncPath + "/**/*";
  }

  // Set the issyncing flag to on so that the client can know if the syncing progress is still going
  await accountModel.syncStart(account.id);

  // This function will list all files/folders/sub-folders recursively.
  let localFilePathList = glob.sync(rootFolder);

  // If the main folder is a directory, prepend its path to the list so that the main folder is also added in the "nodes" folder
  if (params.sync_path && fs.statSync(params.sync_path).isDirectory()) {
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

    if (record && Math.abs(fileModifiedTime - record.file_update_at) >= 2) {
      console.log(
        "Uploading local changes of " +
        filePath +
        " since " +
        new Date(record.file_update_at * 1000).toLocaleString() +
        " notequal " +
        new Date(fileModifiedTime * 1000).toLocaleString()
      );

      // Upload the local changes to the server.
      await remote.upload({
        account: account,
        filePath: filePath,
        rootNodeId: rootNodeId
      });
      continue;
    }
  } // Filelist iteration end

  // TODO CASE 3: Check if file is present in DB but missing on local disk (file was deleted on local)
  // Delete node from server and once response received, delete record from DB.
  if (counter === localFilePathList.length) {
    await this.recursiveDelete({
      account: account
    });
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
    fileList: localFilePathList,
    column: "node_id"
  });

  for (const missingNode of missingFiles) {
    // Delete the node from the server, once thats done it will delete the record from the DB as well
    await remote.deleteServerNode({
      account: account,
      deletedNodeId: missingNode
    });
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

  if (account.sync_enabled == 0) {
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
    console.log(error);
    await errorLogModel.add(account.id, error);
    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);
  }
};

_createItemOnLocal = async params => {
  let account = params.account;
  let node = params.node;
  let currentPath = params.currentPath;
  let sourceNodeId = params.sourceNodeId;

  try {
    if (node.is_folder === true) {
      // If the child is a folder, create the folder first
      if (!fs.existsSync(currentPath)) {
        mkdirp.sync(currentPath);
      }

      // Add reference to the nodes table
      await nodeModel.add({
        account: account,
        nodeId: sourceNodeId,
        filePath: currentPath,
        fileUpdateAt: _base.convertToUTC(node.modified_at),
        // fileUpdateAt: _base.getFileModifiedTime(currentPath),
        isFolder: true,
        isFile: false
      });
    } else if (node.is_file === true) {
      // If the child is a file, download it
      await remote.download({
        account: account,
        sourceNodeId: sourceNodeId,
        destinationPath: currentPath
      });
    }
  } catch (error) {
    console.log(error);
    await errorLogModel.add(account.id, error);
  }
};
