const { accountModel } = require("../models/account");
const { nodeModel } = require("../models/node");
const { watcherModel } = require("../models/watcher");
const { errorLogModel } = require("../models/log-error");
const watcher = require("../helpers/watcher");
const rimraf = require('rimraf');
const crypt = require("../config/crypt");
const _path = require('../helpers/path');
const emitter = require('../helpers/emitter').emitter;

exports.getAll = async (request, response) => {
  const syncEnabled = request.query.sync_enabled;
  accountModel.findAll({
    attributes: { exclude: ['password'] },
    where: {
      sync_enabled: syncEnabled
    }
  })
    .then(data => {
      return response.status(200).json(data.map(data => data.dataValues));
    })
    .catch(error => {
      return response.status(400).json(error);
    });
};

exports.getOne = async (request, response) => {
  accountModel.findByPk(request.params.id, {
    attributes: { exclude: ['password'] },
  })
    .then(data => {
      return response.status(200).json(data.dataValues);
    })
    .catch(error => {
      return response.status(400).json(error);
    })
};

exports.addAccount = async (request, response) => {
  accountModel.create({
    instance_url: request.body.instance_url.replace(/\/+$/, ""),
    username: request.body.username,
    password: crypt.encrypt(request.body.password),
    sync_path: _path.toUnix(request.body.sync_path),
    sync_enabled: request.body.sync_enabled,
    sync_frequency: request.body.sync_frequency
  })
    .then(data => {
      return response.status(200).json(data.dataValues);
    })
    .catch(error => {
      errorLogModel.add(account, error);
      return response.status(500).json(data.dataValues);
    });
};

exports.updateAccount = async (request, response) => {
  accountModel.update({
    instance_url: request.body.instance_url.replace(/\/+$/, ""),
    username: request.body.username,
    password: crypt.encrypt(request.body.password),
    sync_path: _path.toUnix(request.body.sync_path),
    sync_enabled: request.body.sync_enabled,
    sync_frequency: request.body.sync_frequency,
    updated_at: new Date().getTime()
  }, {
      where: {
        id: request.params.id
      }
    })
    .then(() => {
      return response.status(200).json({ account_id: request.params.id });
    })
    .catch(error => {
      errorLogModel.add(account, error);
      return response.status(500).json(data.dataValues);
    });
};

exports.updateCredentials = async (request, response) => {
  accountModel.update({
    instance_url: request.body.instance_url.replace(/\/+$/, ""),
    username: request.body.username,
    password: crypt.encrypt(request.body.password),
    updated_at: new Date().getTime()
  }, {
      where: {
        id: request.params.id
      }
    })
    .then(() => {
      return response.status(200).json({ account_id: request.params.id });
    })
    .catch(error => {
      errorLogModel.add(account, error);
      return response.status(500).json(data.dataValues);
    });

  // emitter.once('updateCredentials', async (data) => {
  //   await watcher.watchAll();
  //   return response.status(200).json({
  //     account_id: request.params.id
  //   });
  // });

  // await accountModel.updateCredentials(request.params.id, request);
};

exports.updateSyncPath = async (request, response) => {
  emitter.once('updateSyncPath', async (data) => {
    await watcher.watchAll();
    return response.status(200).json({
      account_id: request.params.id
    });
  });

  const account = await accountModel.getOne(request.params.id);
  await accountModel.updateSyncPath(account, request);
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
  await accountModel.syncComplete({ account: request.params.id });
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
