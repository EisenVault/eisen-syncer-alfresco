const Sequelize = require("sequelize");
const fs = require("fs");
const path = require("path");
const _path = require("../path");
const { nodeModel } = require("../../models/node");
const { watcherModel } = require("../../models/watcher");
const _base = require("./_base");
const _ = require("lodash");
const ondemand = require("./ondemand");
const fileWatcher = require("../watcher");

exports.create = async ({ account, watcherData, socketData, localPath }) => {
  if (socketData.is_file === true && fs.existsSync(localPath)) {
    return;
  }

  const { dataValues: watcher } = { ...watcherData };
  await _base.createItemOnLocal({
    account,
    watcher,
    node: {
      id: socketData.node_id,
      isFolder: socketData.is_folder,
      isFile: socketData.is_file,
      path: {
        name: path.dirname(socketData.path)
      },
      createdAt: socketData.createdAt,
      modifiedAt: socketData.modifiedAt
    },
    currentPath: localPath,
    socketData
  });
};

exports.update = async ({ account, watcherData, socketData, localPath }) => {
  const nodeData = await nodeModel.findOne({
    where: {
      account_id: account.id,
      site_id: watcherData.site_id,
      node_id: socketData.node_id
    }
  });

  const { dataValues: nodeRecord } = { ...nodeData };
  if (nodeRecord && nodeRecord.upload_in_progress === true) {
    return;
  }

  if (
    fs.existsSync(localPath) &&
    _base.convertToUTC(socketData.modifiedAt) <
      _base.getFileModifiedTime(localPath)
  ) {
    return;
  }

  const { dataValues: watcher } = { ...watcherData };
  await _base.createItemOnLocal({
    account,
    watcher,
    node: {
      id: socketData.node_id,
      isFolder: socketData.is_folder,
      isFile: socketData.is_file,
      path: {
        name: path.dirname(socketData.path)
      },
      createdAt: socketData.createdAt,
      modifiedAt: socketData.modifiedAt
    },
    currentPath: localPath,
    socketData
  });
};

exports.move = async params => {
  const { account, watcherData, socketData, localPath } = params;

  // If moved to a different site that isnt watched, just delete the node
  if (typeof watcherData === "undefined") {
    const nodeData = await nodeModel.findOne({
      where: {
        account_id: account.id,
        node_id: socketData.node_id
      }
    });

    // If the record does not exists, probably the file does not exist on local, bail out!
    if (_.isEmpty(nodeData)) {
      return;
    }

    const { dataValues: node } = { ...nodeData };

    const custom = {
      node,
      account
    };

    _base.customRimRaf(node.file_path, custom, async custom => {
      // Delete the record from the DB
      if (custom.node.is_file === true) {
        await nodeModel.destroy({
          where: {
            account_id: custom.account.id,
            node_id: custom.node.node_id
          }
        });
      } else if (custom.node.is_folder === true) {
        // Delete all records that are relavant to the file/folder path
        await nodeModel.destroy({
          where: {
            account_id: custom.account.id,
            [Sequelize.Op.or]: [
              {
                file_path: {
                  [Sequelize.Op.like]: custom.node.file_path + "%"
                }
              },
              {
                local_folder_path: custom.node.file_path
              }
            ]
          }
        });

        const localToRemotePath = _path.getRemotePathFromLocalPath({
          account: custom.account,
          localPath: custom.node.file_path
        });

        // Delete the folder record from the watcher table
        await watcherModel.destroy({
          where: {
            account_id: custom.account.id,
            site_id: custom.node.site_id,
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

    return;
  }

  // If moved within the same site, just rename the node
  if (watcherData) {
    const nodeData = await nodeModel.findOne({
      where: {
        account_id: account.id,
        site_id: watcherData.site_id,
        node_id: socketData.node_id
      }
    });

    // If the record does not exists, probably the file does not exist on local, bail out!
    if (_.isEmpty(nodeData)) {
      return;
    }

    const { dataValues: node } = { ...nodeData };
    const { dataValues: watcher } = { ...watcherData };

    // Get the sitename from the localpath
    const localDirectoryPath = _path.getLocalPathFromNodePath({
      account,
      nodePath: socketData.path
    });

    // Close file watching
    fileWatcher.closeAll();
    const custom = {
      node,
      account,
      watcher,
      socketData,
      localPath,
      localDirectoryPath
    };

    _base.customRimRaf(node.file_path, custom, async custom => {
      // Resume file watching
      fileWatcher.watchAll();

      // Delete the record from the DB
      if (custom.node.is_file === true) {
        await nodeModel.destroy({
          where: {
            account_id: custom.account.id,
            node_id: custom.node.node_id
          }
        });

        // Download the single file
        await _base.createItemOnLocal({
          account: custom.account,
          watcher: custom.watcher,
          node: {
            id: custom.socketData.node_id,
            isFolder: custom.socketData.is_folder,
            isFile: custom.socketData.is_file,
            path: {
              name: path.dirname(custom.socketData.path)
            },
            createdAt: custom.socketData.createdAt,
            modifiedAt: custom.socketData.modifiedAt
          },
          currentPath: custom.localPath,
          socketData
        }); // end createItem
      } else if (custom.node.is_folder === true) {
        // Delete all records that are relavant to the file/folder path
        await nodeModel.destroy({
          where: {
            account_id: custom.account.id,
            [Sequelize.Op.or]: [
              {
                file_path: {
                  [Sequelize.Op.like]: custom.node.file_path + "%"
                }
              },
              {
                local_folder_path: custom.node.file_path
              }
            ]
          }
        });

        const localToRemotePath = _path.getRemotePathFromLocalPath({
          account: custom.account,
          localPath: custom.node.file_path
        });

        // Delete the folder record from the watcher table
        await watcherModel.destroy({
          where: {
            account_id: custom.account.id,
            site_id: custom.node.site_id,
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

        // Download the folders recursively
        _base.createItemOnLocal({
          account: custom.account,
          watcher: custom.watcher,
          node: {
            id: custom.socketData.node_id,
            isFolder: custom.socketData.is_folder,
            isFile: custom.socketData.is_file,
            path: {
              name: path.dirname(custom.socketData.path)
            },
            createdAt: custom.socketData.createdAt,
            modifiedAt: custom.socketData.modifiedAt
          },
          currentPath: custom.localDirectoryPath,
          socketData
        });

        // Download all files inside folder
        await ondemand.recursiveDownload({
          account: custom.account,
          watcher: custom.watcher,
          sourceNodeId: custom.socketData.node_id,
          destinationPath: custom.account.sync_path
        });
      }
    });
  }
};

exports.delete = async params => {
  const nodeData = await nodeModel.findOne({
    where: {
      account_id: params.account.id,
      node_id: params.node_id
    }
  });

  // If the node does not exists, probably the file does not exist on local, bail out!
  if (_.isEmpty(nodeData)) {
    return;
  }

  const { dataValues: node } = { ...nodeData };

  const watcherData = await watcherModel.findOne({
    where: {
      account_id: node.account_id
    }
  });

  // If the node is not being watched, bail out!
  if (_.isEmpty(watcherData)) {
    return;
  }

  const { dataValues: watcher } = { ...watcherData };

  const custom = {
    node,
    watcher,
    account: params.account
  };

  // If node is deleted on server, delete the file on local
  _base.customRimRaf(node.file_path, custom, async custom => {
    // Delete the node record
    await nodeModel.destroy({
      where: {
        account_id: custom.node.account_id,
        site_id: custom.watcher.site_id,
        node_id: custom.node.node_id
      }
    });

    // Delete the folder record from the watcher table
    if (custom.node.is_folder === true) {
      const localToRemotePath = _path.getRemotePathFromLocalPath({
        account: custom.account,
        localPath: custom.node.file_path
      });

      await watcherModel.destroy({
        where: {
          account_id: custom.node.account_id,
          site_id: custom.node.site_id,
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

  return;
};
