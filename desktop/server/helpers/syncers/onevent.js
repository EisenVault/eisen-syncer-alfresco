const Sequelize = require('sequelize');
const fs = require("fs");
const path = require("path");
const _path = require("../path");
const { nodeModel } = require("../../models/node");
const { watcherModel } = require("../../models/watcher");
const _base = require("./_base");
const rimraf = require('rimraf');
const _ = require('lodash');
const ondemand = require('./ondemand');

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
    currentPath: localPath
  });
}

exports.update = async params => {
  if (fs.existsSync(params.localPath) &&
    _base.convertToUTC(params.socketData.modifiedAt) < _base.getFileModifiedTime(params.localPath)) {
    return;
  }

  exports.create(params);
}

exports.move = async params => {
  const { account, watcherData, socketData, localPath } = params;
  const nodeData = await nodeModel.findOne({
    where: {
      node_id: socketData.node_id
    }
  });

  // If the record does not exists, probably the file does not exist on local, bail out!
  if (_.isEmpty(nodeData)) {
    return;
  }

  const { dataValues: node } = { ...nodeData };

  // If moved within the same site, just rename the node
  if (watcherData) {
    const { dataValues: watcher } = { ...watcherData };
    // Get the sitename from the localpath
    const localDirectoryPath = _path.getLocalPathFromNodePath({
      account,
      nodePath: socketData.path
    });

    rimraf(node.file_path, async () => {
      // Delete the record from the DB
      if (node.is_file === true) {
        await nodeModel.destroy({
          where: {
            account_id: account.id,
            node_id: node.node_id
          }
        });

        // Download the single file
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
          currentPath: localPath
        }); // end createItem

      } else if (node.is_folder === true) {
        // Delete all records that are relavant to the file/folder path
        await nodeModel.destroy({
          where: {
            account_id: account.id,
            [Sequelize.Op.or]: [
              {
                file_path: {
                  [Sequelize.Op.like]: node.file_path + "%"
                }
              },
              {
                local_folder_path: node.file_path
              }
            ]
          }
        });

        // Download the folders recursively
        _base.createItemOnLocal({
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
          currentPath: localDirectoryPath
        });

        // Download all files inside folder
        await ondemand.recursiveDownload({
          account,
          watcher,
          sourceNodeId: socketData.node_id,
          destinationPath: account.sync_path
        });
      }
    });

  }

  // If moved to a different site that isnt watched, just delete the node
  if (watcherData === null) {
    // Perhaps the file was RENAMED on server. Delete from local
    rimraf(node.file_path, async () => {
      // Delete the record from the DB
      if (node.is_file === true) {
        await nodeModel.destroy({
          where: {
            account_id: account.id,
            node_id: node.node_id
          }
        });
      } else if (node.is_folder === true) {
        // Delete all records that are relavant to the file/folder path
        await nodeModel.destroy({
          where: {
            account_id: account.id,
            [Sequelize.Op.or]: [
              {
                file_path: {
                  [Sequelize.Op.like]: node.file_path + "%"
                }
              },
              {
                local_folder_path: node.file_path
              }
            ]
          }
        });
      }
    });
  }
}

exports.delete = async params => {
  const nodeData = await nodeModel.findOne({
    where: {
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

  // If node is deleted on server, delete the file on local
  rimraf(node.file_path, async () => {
    // Delete the node record
    await nodeModel.destroy({
      where: {
        account_id: node.account_id,
        node_id: params.node_id
      }
    });
  });

  return;
}
