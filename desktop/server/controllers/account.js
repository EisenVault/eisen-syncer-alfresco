const accountModel = require("../models/account");
const nodeModel = require("../models/node");
const watcherModel = require("../models/watcher");
const errorLogModel = require("../models/log-error");
const watcher = require("../helpers/watcher");
const rimraf = require('rimraf');

exports.getAll = async (request, response) => {
  let syncEnabled = request.query.sync_enabled;
  return response.status(200).json(await accountModel.getAll(syncEnabled, 0));
};

exports.getOne = async (request, response) => {
  return response
    .status(200)
    .json(await accountModel.getOne(request.params.id));
};

exports.addAccount = async (request, response) => {
  // If its a new account add it to the DB
  let accountId = await accountModel.addAccount(request);
  await watcher.watchAll();
  return response.status(201).json({
    account_id: accountId[0]
  });
};

exports.updateAccount = async (request, response) => {
  await accountModel.updateAccount(request.params.id, request);
  await watcher.watchAll();
  return response.status(200).json({
    account_id: request.params.id
  });
};

exports.addWatchNodes = async (request, response) => {
  // Delete old watch nodes
  await watcherModel.deleteAllByAccountId(request.params.id);

  let insertedRecords = [];
  for (const iterator of request.body) {
    if (insertedRecords.indexOf(iterator.watchPath) === -1) {
      await watcherModel.addWatcher(request.params.id, iterator);
      insertedRecords.push(iterator.watchPath);
    }
  }

  return response.status(200).json({
    success: true
  });
};

exports.updateSync = async (request, response) => {
  await accountModel.updateSync(request.params.id, request);
  await watcher.watchAll();
  return response.status(200).json({
    success: true
  });
};

exports.updateSyncTime = async (request, response) => {
  await accountModel.syncComplete(request.params.id);
  await watcher.watchAll();

  return response.status(200).json({
    success: true
  });
};

exports.deleteAccount = async (request, response) => {
  const accountId = request.params.id;
  const forceDelete = request.params.force_delete;
  let deleteAccount = null;

  if (forceDelete === "true") {
    // Permanantly delete account, files and all node data from the db
    const account = await accountModel.getOne(accountId);
    const watchers = await watcherModel.getAllByAccountId(accountId);

    for (const iterator of watchers) {
      try {
        // Remove the files physically...
        rimraf(account.sync_path + '/' + iterator.site_name, () => {
          console.log('Done');
        });
      } catch (error) {
        errorLogModel.add(account.id, error);
      }
    }

  }

  deleteAccount = await accountModel.forceDelete(accountId);
  await nodeModel.forceDeleteAll(accountId);
  await watcherModel.deleteAllByAccountId(accountId);

  await watcher.watchAll();
  return response.status(200).json(deleteAccount);
};
