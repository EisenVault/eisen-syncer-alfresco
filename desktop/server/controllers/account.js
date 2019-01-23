const { accountModel } = require("../models/account");
const { nodeModel } = require("../models/node");
const { watcherModel } = require("../models/watcher");
const { add: errorLogAdd } = require("../models/log-error");
const watcher = require("../helpers/watcher");
const rimraf = require('rimraf');
const crypt = require("../config/crypt");
const _path = require('../helpers/path');
const fileWatcher = require("../helpers/watcher");

exports.getAll = async (request, response) => {
  const syncEnabled = request.query.sync_enabled;
  let whereCondition = {};
  if (syncEnabled) {
    whereCondition.sync_enabled = syncEnabled
  }

  accountModel.findAll({
    attributes: { exclude: ['password'] },
    where: whereCondition
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
      return response.status(201).json(data.dataValues);
    })
    .catch(() => {
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
      errorLogAdd(request.params.id, error);
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
      errorLogAdd(request.params.id, error);
      return response.status(500).json(data.dataValues);
    });
};

exports.updateSyncPath = async (request, response) => {
  accountModel.update({
    sync_path: _path.toUnix(request.body.sync_path),
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
      errorLogAdd(request.params.id, error);
      return response.status(500).json(data.dataValues);
    });
};

exports.addWatchNodes = async (request, response) => {
  watcherModel.destroy({
    where: {
      account_id: request.params.id
    }
  })
    .then(() => {
      let insertedRecords = [];
      for (const iterator of request.body) {
        if (insertedRecords.indexOf(iterator.watchPath) === -1) {
          watcherModel.create({
            account_id: request.params.id,
            site_name: iterator.siteName,
            site_id: iterator.siteId,
            document_library_node: iterator.documentLibraryId,
            watch_node: iterator.watchNodeId,
            watch_folder: iterator.watchPath,
          })
            .then(() => {
              return response.status(200).json({ account_id: request.params.id });
            })
            .catch(error => {
              errorLogAdd(request.params.id, error);
              return response.status(500).json(error);
            });
          insertedRecords.push(iterator.watchPath);
        }
      }

    })
    .catch(error => {
      errorLogAdd(request.params.id, error);
      return response.status(500).json(error);
    });
};

exports.updateSync = async (request, response) => {
  accountModel.update({
    sync_enabled: request.body.sync_enabled,
    sync_in_progress: 0,
    download_in_progress: 0,
    upload_in_progress: 0,
    updated_at: new Date().getTime()
  }, {
      where: {
        id: request.params.id
      }
    })
    .then(() => {
      // Start watcher now
      fileWatcher.watchAll();
      return response.status(200).json({ account_id: request.params.id });
    })
    .catch(error => {
      errorLogAdd(request.params.id, error);
      return response.status(500).json(error);
    });
};

exports.deleteAccount = async (request, response) => {
  const accountId = request.params.id;
  const forceDelete = request.params.force_delete;

  accountModel.findByPk(accountId)
    .then(account => {
      watcherModel.findAll({ account_id: accountId })
        .then(watchers => {
          // Permanantly delete account, files and all node data from the db
          if (forceDelete === 'true') {
            for (const watcher of watchers) {
              // Remove the files physically...
              rimraf(account.dataValues.sync_path + '/' + watcher.dataValues.site_name, () => { });
            }
          }

          accountModel.destroy({
            where: {
              id: accountId
            }
          })
            .then(() => {
              nodeModel.destroy({
                where: {
                  account_id: accountId
                }
              })
                .then(() => {
                  watcherModel.destroy({
                    where: {
                      account_id: accountId
                    }
                  }).then()
                })
            })
            .catch(error => console.log(error));

          watcher.watchAll();
          return response.status(200).json({});
        })
        .catch(error => console.log(error));
    })
    .catch(error => console.log(error));
};
