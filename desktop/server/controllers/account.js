const accountModel = require("../models/account");
const watcher = require("../helpers/watcher");

exports.getAll = async (request, response) => {
  let syncEnabled = request.query.sync_enabled;
  return response.status(200).json(await accountModel.getAll(syncEnabled));
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
  let deleteAccount = await accountModel.deleteAccount(request.params.id);
  await watcher.watchAll();

  return response.status(200).json(deleteAccount);
};
