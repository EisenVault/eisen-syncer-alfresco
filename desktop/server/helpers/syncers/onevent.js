const fs = require("fs-extra");
const path = require("path");
const mkdirp = require("mkdirp");
const accountModel = require("../../models/account");
const remote = require("../remote");
const nodeModel = require("../../models/node");
const errorLogModel = require("../../models/log-error");
const watcher = require("../watcher");
const _base = require("./_base");

exports.create = async params => {
  let instance_url = _getInstanceUrl(params.instance_url);
  let account = await accountModel.findByEnabledSyncInstance(instance_url);

  if (!account) {
    return;
  }

  let currentPath = _getPath(account, params.path);

  // Set the issyncing flag to on so that the client can know if the syncing progress is still going
  await accountModel.syncStart(account.id);

  // Stop watcher for a while
  watcher.unwatchAll();

  try {
    // If the node is a folder, we will create the folder and all its subfolders
    if (params.is_folder === true) {
      mkdirp.sync(currentPath);

      // Add reference to the nodes table
      await nodeModel.add({
        account: account,
        nodeId: params.node_id,
        filePath: currentPath,
        fileUpdateAt: _base.getFileModifiedTime(currentPath),
        isFolder: true,
        isFile: false
      });

      // Start watcher now
      watcher.watchAll();

      // Set the sync completed time and also set issync flag to off
      await accountModel.syncComplete(account.id);
    } else if (params.is_file === true) {
      mkdirp.sync(path.dirname(currentPath));

      await remote.download({
        account: account,
        sourceNodeId: params.node_id,
        destinationPath: currentPath
      });

      // Start watcher now
      watcher.watchAll();

      // Set the sync completed time and also set issync flag to off
      await accountModel.syncComplete(account.id);
    }
  } catch (error) {
    // Start watcher now
    watcher.watchAll();
    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);
    await errorLogModel.add(account.id, error);
  }
};

// Update the file
exports.update = async params => {
  let instance_url = _getInstanceUrl(params.instance_url);
  let account = await accountModel.findByEnabledSyncInstance(instance_url);

  if (!account) {
    return;
  }

  let currentPath = _getPath(account, params.path);

  // Set the issyncing flag to on so that the client can know if the syncing progress is still going
  await accountModel.syncStart(account.id);

  // Stop watcher for a while
  watcher.unwatchAll();

  let oldRecord = await nodeModel.getOneByNodeId({
    account: account,
    nodeId: params.node_id
  });

  try {
    // If the node is a folder, we will create the folder
    if (params.is_folder === true && currentPath !== oldRecord.file_path) {
      // Rename the old folder to the new name
      fs.renameSync(oldRecord.file_path, currentPath);

      // Delete the old reference
      await nodeModel.delete({
        account: account,
        nodeId: params.node_id
      });

      // Add reference to the nodes table
      await nodeModel.add({
        account: account,
        nodeId: params.node_id,
        filePath: currentPath,
        fileUpdateAt: _base.getFileModifiedTime(currentPath),
        isFolder: true,
        isFile: false
      });

      // Start watcher now
      watcher.watchAll();

      // Set the sync completed time and also set issync flag to off
      await accountModel.syncComplete(account.id);
    } else if (params.is_file === true) {
      // Delete the old file
      fs.removeSync(oldRecord.file_path);

      // Delete the old reference
      await nodeModel.delete({
        account: account,
        nodeId: params.node_id
      });

      // Download the renamed/edited file
      await remote.download({
        account: account,
        sourceNodeId: params.node_id,
        destinationPath: currentPath
      });

      // Start watcher now
      watcher.watchAll();

      // Set the sync completed time and also set issync flag to off
      await accountModel.syncComplete(account.id);
    }
  } catch (error) {
    await errorLogModel.add(account.id, error);
    // Start watcher now
    watcher.watchAll();
    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);
  }
};

exports.delete = async params => {
  let instance_url = _getInstanceUrl(params.instance_url);
  let account = await accountModel.findByEnabledSyncInstance(instance_url);

  if (!account) {
    return;
  }

  // Set the is_syncing flag to on so that the client can know if the syncing progress is still going
  await accountModel.syncStart(account.id);

  let record = await nodeModel.getOneByNodeId({
    account: account,
    nodeId: params.node_id
  });

  if (!record) {
    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);
    return;
  }

  let path = record.file_path;

  // Make sure you do not delete the root path by mistake
  if (account.sync_path !== path) {
    fs.removeSync(path);
  }

  try {
    // Then remove the entry from the DB
    await nodeModel.delete({
      account: account,
      nodeId: params.node_id
    });

    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);
  } catch (error) {
    await errorLogModel.add(account.id, error);
    // Set the sync completed time and also set issync flag to off
    await accountModel.syncComplete(account.id);
  }
};

_getPath = (account, path) => {
  return account.sync_path + "/" + path.split("documentLibrary/")[1] || "";
};

_getInstanceUrl = instance_url => {
  return instance_url.replace(/\/+$/, ""); // Replace any trailing slashes
};
