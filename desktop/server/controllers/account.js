const { accountModel } = require("../models/account");
const { nodeModel } = require("../models/node");
const { watcherModel } = require("../models/watcher");
const { add: errorLogAdd } = require("../models/log-error");
const watcher = require("../helpers/watcher");
const rimraf = require("rimraf");
const crypt = require("../config/crypt");
const fs = require("fs");
const path = require("path");
const _path = require("../helpers/path");
const _base = require("../helpers/syncers/_base");
const fileWatcher = require("../helpers/watcher");
const mkdirp = require("mkdirp");

exports.getAll = async (request, response) => {
  const syncEnabled = request.query.sync_enabled;
  let whereCondition = {};
  if (syncEnabled) {
    whereCondition.sync_enabled = syncEnabled;
  }

  accountModel
    .findAll({
      attributes: { exclude: ["password"] },
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
  accountModel
    .findByPk(request.params.id, {
      attributes: { exclude: ["password"] }
    })
    .then(data => {
      return response.status(200).json(data.dataValues);
    })
    .catch(error => {
      return response.status(400).json(error);
    });
};

exports.addAccount = async (request, response) => {
  accountModel
    .create({
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
    .catch(error => {
      return response.status(500).json(error);
    });
};

exports.updateAccount = async (request, response) => {
  accountModel
    .update(
      {
        instance_url: request.body.instance_url.replace(/\/+$/, ""),
        username: request.body.username,
        password: crypt.encrypt(request.body.password),
        sync_path: _path.toUnix(request.body.sync_path),
        sync_enabled: request.body.sync_enabled,
        sync_frequency: request.body.sync_frequency,
        updated_at: new Date().getTime()
      },
      {
        where: {
          id: request.params.id
        }
      }
    )
    .then(() => {
      return response.status(200).json({ account_id: request.params.id });
    })
    .catch(error => {
      errorLogAdd(request.params.id, error, `${__filename}/updateAccount`);
      return response.status(500).json(error);
    });
};

exports.updateCredentials = async (request, response) => {
  accountModel
    .update(
      {
        instance_url: request.body.instance_url.replace(/\/+$/, ""),
        username: request.body.username,
        password: crypt.encrypt(request.body.password),
        updated_at: new Date().getTime()
      },
      {
        where: {
          id: request.params.id
        }
      }
    )
    .then(() => {
      return response.status(200).json({ account_id: request.params.id });
    })
    .catch(error => {
      errorLogAdd(request.params.id, error, `${__filename}/updateCredentials`);
      return response.status(500).json(error);
    });
};

exports.updateSyncPath = async (request, response) => {
  accountModel
    .update(
      {
        sync_path: _path.toUnix(request.body.sync_path),
        updated_at: new Date().getTime()
      },
      {
        where: {
          id: request.params.id
        }
      }
    )
    .then(() => {
      return response.status(200).json({ account_id: request.params.id });
    })
    .catch(error => {
      errorLogAdd(request.params.id, error, `${__filename}/update`);
      return response.status(500).json(error);
    });
};

exports.addWatchNodes = async (request, response) => {
  // Remove old watchers first
  watcherModel
    .destroy({
      where: {
        account_id: request.params.id
      }
    })
    .then(async () => {
      let insertedRecords = [];
      for (const iterator of request.body) {
        if (insertedRecords.indexOf(iterator.watchPath) === -1) {
          const account = await accountModel.findOne({
            where: {
              id: request.params.id
            }
          });

          // Create the local path
          const localPath = _path.getLocalPathFromNodePath({
            account,
            nodePath: iterator.watchPath
          });

          if (!fs.existsSync(localPath)) {
            mkdirp(localPath);
          }

          // Add to nodes table
          try {
            await nodeModel.create({
              account_id: request.params.id,
              site_id: iterator.site.id,
              node_id: iterator.id,
              remote_folder_path: iterator.watchPath,
              file_name: path.basename(localPath),
              file_path: _path.toUnix(localPath),
              local_folder_path: _path.toUnix(path.dirname(localPath)),
              file_update_at: _base.getCurrentTime(),
              last_uploaded_at: 0,
              last_downloaded_at: _base.getCurrentTime(),
              is_folder: true,
              is_file: false,
              download_in_progress: false,
              upload_in_progress: false
            });
          } catch (error) {}

          // Add to watch list
          watcherModel
            .create({
              account_id: request.params.id,
              site_name: iterator.site.siteId,
              site_id: iterator.site.id,
              document_library_node: iterator.documentLibrary,
              parent_node: iterator.parentId,
              watch_node: iterator.id,
              watch_folder: iterator.watchPath
            })
            .then(() => {})
            .catch(error => {
              errorLogAdd(
                request.params.id,
                error,
                `${__filename}/addWatchNodes1`
              );
            });
          insertedRecords.push(iterator.watchPath);
        }
      }

      return response.status(200).json({ account_id: request.params.id });
    })
    .catch(error => {
      errorLogAdd(request.params.id, error, `${__filename}/addWatchNodes2`);
      return response.status(500).json(error);
    });
};

exports.updateSync = async (request, response) => {
  accountModel
    .update(
      {
        sync_enabled: request.body.sync_enabled,
        sync_in_progress: 0,
        download_in_progress: 0,
        upload_in_progress: 0,
        updated_at: new Date().getTime()
      },
      {
        where: {
          id: request.params.id
        }
      }
    )
    .then(() => {
      // Start watcher now
      fileWatcher.watchAll();
      return response.status(200).json({ account_id: request.params.id });
    })
    .catch(error => {
      errorLogAdd(request.params.id, error, `${__filename}/updateSync`);
      return response.status(500).json(error);
    });
};

exports.deleteAccount = async (request, response) => {
  const accountId = request.params.id;
  const forceDelete = request.params.force_delete;

  accountModel
    .findByPk(accountId)
    .then(account => {
      watcherModel
        .findAll({
          where: {
            account_id: accountId
          }
        })
        .then(watchers => {
          // Permanantly delete account, files and all node data from the db
          if (forceDelete === "true") {
            for (const watcher of watchers) {
              // Remove the files physically...
              rimraf(
                account.dataValues.sync_path +
                  "/" +
                  watcher.dataValues.site_name,
                () => {}
              );
            }
          }

          accountModel
            .destroy({
              where: {
                id: accountId
              }
            })
            .then(() => {
              nodeModel
                .destroy({
                  where: {
                    account_id: accountId
                  }
                })
                .then(() => {
                  watcherModel
                    .destroy({
                      where: {
                        account_id: accountId
                      }
                    })
                    .then();
                });
            })
            .catch(error => console.log(error));

          watcher.watchAll();
          return response.status(200).json({});
        })
        .catch(error => console.log(error));
    })
    .catch(error => console.log(error));
};
