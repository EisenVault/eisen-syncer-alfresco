const accountModel = require("../models/account");
const nodeModel = require("../models/node");
const watcher = require("../helpers/watcher");
const fs = require("fs-extra");

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

exports.updateWatchNode = async (request, response) => {
  await accountModel.updateWatchNode(request.params.id, request);
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
    // Remove the files physically...
    fs.removeSync(account.sync_path);

    deleteAccount = await accountModel.forceDelete(accountId);
    await nodeModel.forceDeleteAll(accountId);
  } else {
    deleteAccount = await accountModel.deleteAccount(accountId);
  }

  await watcher.watchAll();
  return response.status(200).json(deleteAccount);
};
