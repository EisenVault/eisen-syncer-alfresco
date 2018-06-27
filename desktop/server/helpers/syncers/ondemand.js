const fs = require("fs-extra");
const _ = require("lodash");
const path = require("path");
const glob = require("glob");
const accountModel = require("../../models/account");
const remote = require("../remote");
const nodeModel = require("../../models/node");
const errorLogModel = require("../../models/log-error");
const watcher = require("../watcher");
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

  // Declare a container that will hold all node ids that are fetched from the server
  if (typeof this.recursiveDownload.serverFileList == "undefined") {
    this.recursiveDownload.serverFileList = [];

    this.recursiveDownload.serverNodes = await remote.getNodeCount({
      account: account,
      nodeId: account.watch_node
    });
  }

  try {
    // Start the sync
    await accountModel.syncStart(account.id);

    // Stop watcher for a while
    // watcher.unwatchAll();

    // Get all the child items of the given nodeid
    let childrens = await remote.getChildren({
      account: account,
      parentNodeId: sourceNodeId
    });

    // If no children are found, no point in proceeding further, so bailout!
    if (!childrens) {
      // Start watcher now
      // watcher.watchAll();
      // Set the sync completed time and also set issync flag to off
      await accountModel.syncComplete(account.id);
      return;
    }

    let counter = 0;
    for (const child of childrens.list.entries) {
      counter++;
      let currentDirectory = path.join(destinationPath, child.entry.name);
      let sourceNodeId = child.entry.id;

      // Add each server file/directory in the global container so that we can later compare which one needs to be deleted on local.
      this.recursiveDownload.serverFileList.push(currentDirectory);

      let record = await nodeModel.getOneByNodeId({
        account: account,
        nodeId: sourceNodeId
      });

      // Case 1: Check If the remote node is NOT present on local
      if (!fs.existsSync(currentDirectory)) {
        // Case 1.1 Check File reference is present in DB (perhaps file was renamed on server).
        if (record) {
          // Delete the old file
          fs.removeSync(record.file_path);

          // Delete Old record from DB and update DB and set new filename
          await nodeModel.delete({
            account: account,
            nodeId: sourceNodeId
          });
        }

        // Case 1.1/1.2 Download the file/folder on local (this will also add the new records in the DB)
        await _createItemOnLocal({
          child: child,
          currentDirectory: currentDirectory,
          account: account,
          sourceNodeId: sourceNodeId
        });
      } else {
        // Case 2: File present in local
        if (record) {
          // Convert the time to UTC and then get the unixtimestamp.
          let nodeModifiedDate = _base.convertToUTC(child.entry.modifiedAt);

          // let fileModifiedDate = record.file_update_at;
          let fileModifiedDate = _base.getFileModifiedTime(record.file_path);

          // If the server file time is greater, download the remote file (since server node is newer version)
          if (nodeModifiedDate > fileModifiedDate) {
            await _createItemOnLocal({
              child: child,
              currentDirectory: currentDirectory,
              account: account,
              sourceNodeId: sourceNodeId,
              isRecursive: false
            });

            console.log(
              "Downloading " +
                currentDirectory +
                " since " +
                new Date(nodeModifiedDate * 1000).toLocaleString() +
                " notequal " +
                new Date(fileModifiedDate * 1000).toLocaleString()
            );
          }
        }
      }

      if (child.entry.isFolder === true) {
        // If a folder is found, we will get inside it and iterate through its children nodes
        await this.recursiveDownload({
          account: account,
          sourceNodeId: sourceNodeId,
          destinationPath: currentDirectory
        });
      }
    } // End forloop

    // We will check if this is end of the iteration
    if (
      this.recursiveDownload.serverNodes.node_count ==
      _.uniq(this.recursiveDownload.serverFileList).length
    ) {
      if (_.uniq(this.recursiveDownload.serverFileList).length == 0) {
        // If there are no nodes available in the server, we will remove all files on the local and all db records
        let allFiles = await nodeModel.getAll({
          account: account
        });

        // Iterate through all the files in the DB that are NOT deleted, and delete each one of them
        for (let record of allFiles) {
          fs.removeSync(record.file_path);
        }

        await nodeModel.deleteAll({
          account: account
        });
      } else {
        // For every missing nodes on the server, we will remove from the local as well.
        missingFiles = await nodeModel.getMissingFiles({
          account: account,
          fileList: _.uniq(this.recursiveDownload.serverFileList)
        });

        console.log( 'serverFileList', _.uniq(this.recursiveDownload.serverFileList) );
        console.log( 'missingFiles', missingFiles );
        

        for (const missingFile of missingFiles) {
          console.log("DELETING MISSING", missingFile);

          // Delete the file/folder first
          fs.removeSync(missingFile);

          // Then remove the entry from the DB
          await nodeModel.deleteByPath({
            account: account,
            filePath: missingFile
          });
        }

        // Reset the array
        console.log( 'RESETTING SERVER LIST' );
        
        this.recursiveDownload.serverFileList = [];
      }
      

      // Start watcher now
      // watcher.watchAll();
      // Set the sync completed time and also set issync flag to off
      await accountModel.syncComplete(account.id);
    }
  } catch (error) {
    console.log(error);

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
    let recordExists = await nodeModel.getOneByFilePath({
      account: account,
      filePath: filePath
    });

    // CASE 1: Check if file is available on disk but missing in DB (New node was created).
    // Then Upload the Node to the server and once response received add a record of the same in the "nodes" table.
    if (!recordExists) {
      await remote.upload({
        account: account,
        filePath: filePath,
        rootNodeId: rootNodeId,
        broadcast: true
      });
      continue;
    }

    // CASE 2: Check if file is available on disk but its modified date does not match the one in DB (file was locally updated/modified)
    // Upload the file to the server and once response received update the "file_modified_at" field in the "nodes" table.
    fileModifiedTime = _base.getFileModifiedTime(filePath);

    if (recordExists && Math.abs(fileModifiedTime - recordExists.file_update_at)  > 2 ) {
      console.log(
        "Uploading local changes of " +
          filePath +
          " since " +
          new Date(recordExists.file_update_at * 1000).toLocaleString() +
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
      deletedNodeId: missingNode,
      broadcast: true
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
        deletedNodeId: record.node_id,
        broadcast: true
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
  let child = params.child;
  let currentDirectory = params.currentDirectory;
  let sourceNodeId = params.sourceNodeId;
  let isRecursive = params.isRecursive || true;

  try {
    if (child.entry.isFolder == true) {
      // If the child is a folder, create the folder first
      if (!fs.existsSync(currentDirectory)) {
        fs.mkdirSync(currentDirectory);
      }

      // Add reference to the nodes table
      await nodeModel.add({
        account: account,
        nodeId: sourceNodeId,
        filePath: currentDirectory,
        fileUpdateAt: _base.getFileModifiedTime(currentDirectory),
        isFolder: true,
        isFile: false
      });

      if (isRecursive) {
        await this.recursiveDownload({
          account: account,
          sourceNodeId: sourceNodeId,
          destinationPath: currentDirectory
        });
      }
    } else if (child.entry.isFile == true) {
      // If the child is a file, download it
      await remote.download({
        account: account,
        sourceNodeId: sourceNodeId,
        destinationPath: currentDirectory
      });
    }
  } catch (error) {
    console.log(error);
    await errorLogModel.add(account.id, error);
  }
};
