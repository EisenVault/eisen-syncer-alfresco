const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const { accountModel } = require("../../models/account");
const { nodeModel } = require("../../models/node");
const { watcherModel } = require("../../models/watcher");
const { workerModel } = require("../../models/worker");
const { settingModel } = require("../../models/setting");
const fileWatcher = require("../watcher");
const remote = require("../remote");
const _base = require("./_base");
const _path = require("../path");
const _ = require("lodash");

// Logger
const { logger } = require("../logger");

exports.runUpload = async (isRecursive = false) => {
  const setting = await settingModel.findOne({
    where: {
      name: "SYNC_PAUSE_SECONDS"
    }
  });

  while (true) {
    await _base.sleep(Number(setting.value) * 1000);

    let workerData = await workerModel.findOne({
      order: [["priority", "DESC"], ["id", "ASC"]]
    });

    if (_.isEmpty(workerData)) {
      continue;
    }

    const { dataValues: worker } = workerData;

    // Delete the worker record
    await workerModel.destroy({
      where: {
        id: worker.id
      }
    });

    const accountData = await accountModel.findOne({
      where: {
        id: worker.account_id,
        sync_enabled: true
      }
    });

    if (_.isEmpty(accountData)) {
      continue;
    }

    const { dataValues: account } = { ...accountData };

    const watchers = await watcherModel.findAll({
      where: {
        account_id: account.id
      },
      order: [[Sequelize.fn("length", Sequelize.col("watch_folder")), "DESC"]]
    });

    const filePath = worker.file_path;

    for (const item of watchers) {
      const { dataValues: watcher } = item;

      const siteName = _path.getSiteNameFromPath(filePath);
      const localPath = _path.getLocalPathFromNodePath({
        account,
        nodePath: watcher.watch_folder
      });

      // If the site name is different or the filePath does not belong to the watchlist then ignore...
      if (
        watcher.site_name !== siteName ||
        !`${filePath}/`.includes(`${path.dirname(localPath)}/`)
      ) {
        continue;
      }

      // Following cases are possible...
      // Case A: File created or renamed on local, upload it
      // Case B: File modified on local, upload it
      // Case C: File deleted on server, delete on local
      // Case D: If the record is a folder, delete the worker record and proceed next
      // Case E: If the worker record does not need an upload, no point in keeping it in the DB, delete it
      const localFileModifiedDate = _base.getFileModifiedTime(filePath);
      const localFileSize = _base.getFileSize(filePath);

      // Get the DB record of the filePath
      let nodeData = await nodeModel.findOne({
        where: {
          account_id: account.id,
          site_id: watcher.site_id,
          file_path: filePath
        }
      });
      const { dataValues: record } = { ...nodeData };

      if (record && record.download_in_progress === true) {
        // If the file is stalled, we will change its modified date to a backdated date
        if ((await _base.isStalledDownload(record)) === true) {
          const btime = 395114400000; // Saturday, July 10, 1982 7:30:00 AM
          const mtime = btime;
          const atime = btime;
          _base.deferFileModifiedDate(
            {
              filePath: record.file_path,
              btime,
              mtime,
              atime,
              record
            },
            async params => {
              if (_.has(params, "record.id")) {
                await nodeModel.update(
                  {
                    download_in_progress: false
                  },
                  {
                    where: {
                      id: params.record.id
                    }
                  }
                );
              }
            }
          );
        }
        logger.info("Bailed upload, download in progress. " + filePath);
        continue;
      }

      let statSync = null;
      try {
        statSync = fs.statSync(filePath);
      } catch (error) {
        continue;
      }

      // If its a file and its size is 0, bail out
      if (statSync.isFile() && localFileSize === 0) {
        logger.info("Zero file size. Bailing! " + filePath);
        continue;
      }

      // Case A: File created or renamed on local but unavailable on server, upload it
      if (!record) {
        logger.info("New file, attempting to upload... --- " + filePath);
        await remote.upload({
          account,
          watcher,
          filePath,
          rootNodeId: worker.root_node_id,
          overwrite: "false",
          isNewFile: true
        });
        continue;
      }

      // If the record exists in the DB and has a nodeID
      if (record && record.node_id !== "") {
        // Make a request to the server to get the node details
        const remoteNodeResponse = await remote.getNode({
          account,
          record
        });

        // Give a break if the server throws an internal server error
        if (
          remoteNodeResponse &&
          (remoteNodeResponse.statusCode === 503 ||
            remoteNodeResponse.statusCode === 500)
        ) {
          const pauseTime = 60000;
          logger.info(
            `Pausing ${pauseTime /
              1000} seconds, since server load seems high. Status code: ${
              remoteNodeResponse.statusCode
            }`
          );
          await _base.sleep(pauseTime);
          continue;
        }

        let remoteNodeResponseBody = {};
        if (remoteNodeResponse && "body" in remoteNodeResponse) {
          try {
            remoteNodeResponseBody = JSON.parse(remoteNodeResponse.body);
          } catch (error) {
            logger.info(
              "Unable to parse JSON. Bad response data. Check your internet connection."
            );
            continue;
          }
        }

        // Case B: File modified on local, upload it
        if (
          remoteNodeResponse &&
          remoteNodeResponse.statusCode === 200 &&
          record.is_file === true &&
          record.download_in_progress === false &&
          record.upload_in_progress === false &&
          localFileModifiedDate >
            _base.convertToUTC(remoteNodeResponseBody.entry.modifiedAt)
        ) {
          logger.info(
            "File modified on local, " +
              localFileModifiedDate +
              " - modifiedAt: " +
              remoteNodeResponseBody.entry.modifiedAt +
              " > convertToUTC: " +
              _base.convertToUTC(remoteNodeResponseBody.entry.modifiedAt) +
              " attempting to upload..." +
              filePath
          );

          // Upload the local changes to the server.
          await remote.upload({
            account,
            watcher,
            filePath,
            rootNodeId: worker.root_node_id,
            overwrite: "true",
            isNewFile: false
          });
          continue;
        }

        // Case C: File deleted on server? delete on local
        if (
          remoteNodeResponse &&
          remoteNodeResponse.statusCode === 404 &&
          record.download_in_progress === false &&
          record.upload_in_progress === false
        ) {
          logger.info(
            `Node ${
              record.node_id
            } not available on server, deleting on local: ${
              record.file_path
            } - ${record.id}`
          );

          fileWatcher.closeAll();
          const custom = {
            record,
            account,
            watcher
          };

          // If the node is not found on the server, delete the file on local
          _base.customRimRaf(record.file_path, custom, async custom => {
            fileWatcher.watchAll();
            if (custom.record.is_file === true) {
              await nodeModel.destroy({
                where: {
                  account_id: custom.account.id,
                  site_id: custom.watcher.site_id,
                  node_id: custom.record.node_id
                }
              });
            } else if (custom.record.is_folder === true) {
              // Delete all records that are relavant to the file/folder path
              await nodeModel.destroy({
                where: {
                  account_id: custom.account.id,
                  site_id: custom.watcher.site_id,
                  [Sequelize.Op.or]: [
                    {
                      file_path: {
                        [Sequelize.Op.like]: custom.record.file_path + "%"
                      }
                    },
                    {
                      local_folder_path: custom.record.file_path
                    }
                  ]
                }
              });

              // If the deleted item is a folder, and its also available in the watchlist, delete it
              if (custom.record.is_folder === true) {
                const localToRemotePath = _path.getRemotePathFromLocalPath({
                  account: custom.account,
                  localPath: custom.record.file_path
                });

                await watcherModel.destroy({
                  where: {
                    account_id: custom.account.id,
                    site_id: custom.record.site_id,
                    [Sequelize.Op.or]: [
                      {
                        watch_folder: {
                          [Sequelize.Op.like]: localToRemotePath + "%"
                        }
                      },
                      {
                        watch_folder: localToRemotePath
                      }
                    ]
                  }
                });
              }
            }
          });

          // Process the next worker record
          isRecursive && (await exports.runUpload());
          continue;
        }

        // OR if the node exists on server but that path of node does not match the one with local file path,
        // then delete it from local (possible the file was moved to a different location)
        if (
          remoteNodeResponse &&
          remoteNodeResponse.statusCode === 200 &&
          remoteNodeResponseBody.entry &&
          remoteNodeResponseBody.entry.path.name !== record.remote_folder_path
        ) {
          logger.info(
            `Node was moved to some other location, deleting on local: ${
              record.file_path
            } - ${record.id}`
          );

          fileWatcher.closeAll();
          const custom = {
            account,
            record,
            watcher
          };

          _base.customRimRaf(record.file_path, custom, async custom => {
            fileWatcher.watchAll();
            // Delete all records that are relavant to the file/folder path
            await nodeModel.destroy({
              where: {
                account_id: custom.account.id,
                site_id: custom.watcher.site_id,
                [Sequelize.Op.or]: [
                  {
                    file_path: {
                      [Sequelize.Op.like]: custom.record.file_path + "%"
                    }
                  },
                  {
                    local_folder_path: custom.record.file_path
                  }
                ]
              }
            });

            // If the deleted item is a folder, and its also available in the watchlist, delete it
            if (custom.record.is_folder === true) {
              const localToRemotePath = _path.getRemotePathFromLocalPath({
                account: custom.account,
                localPath: custom.record.file_path
              });

              await watcherModel.destroy({
                where: {
                  account_id: custom.account.id,
                  site_id: custom.record.site_id,
                  [Sequelize.Op.or]: [
                    {
                      watch_folder: {
                        [Sequelize.Op.like]: localToRemotePath + "%"
                      }
                    },
                    {
                      watch_folder: localToRemotePath
                    }
                  ]
                }
              });
            }
          });

          // Process the next worker record
          isRecursive && (await exports.runUpload());
          continue;
        }

        // Process the next worker record
        isRecursive && (await exports.runUpload());
        continue;
      }
    } // End for loop
  }
};
