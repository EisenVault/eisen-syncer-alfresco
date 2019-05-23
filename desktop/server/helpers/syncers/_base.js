const fs = require("fs");
const _path = require("../path");
const path = require("path");
const mkdirp = require("mkdirp");
const { nodeModel } = require("../../models/node");
const { watcherModel } = require("../../models/watcher");
const remote = require("../remote");
const { add: errorLogAdd } = require("../../models/log-error");
const Utimes = require("@ronomon/utimes");
const rimraf = require("rimraf");

exports.deferFileModifiedDate = (params, callback) => {
  const { filePath, btime, mtime, atime } = params;
  const timer = 10000 + Math.ceil(Math.random() * 10) * 1000;
  setTimeout(() => {
    Utimes.utimes(filePath, btime, mtime, atime, error => {
      if (error) {
        errorLogAdd(0, error, `${__filename}/deferFileModifiedDate`);
        return;
      }
      const localFileTimestamp = exports.getFileLocalModifiedTime(filePath);
      if (mtime !== localFileTimestamp) {
        exports.deferFileModifiedDate(params, callback);
        return;
      }
      if (callback) {
        callback(params);
      }
    });
  }, timer);
};

exports.customRimRaf = (path, custom = {}, callback) => {
  rimraf(path, () => {
    callback(custom);
  });
};

/**
 * Returns the latest modified date between the physical file vs its record in db.
 *
 * @param object record
 * {
 *  record: <Object>
 * }
 */
exports.getFileLatestTime = record => {
  try {
    if (fs.existsSync(record.file_path)) {
      let fileStat = fs.statSync(record.file_path);
      let fileModifiedTime = exports.convertToUTC(fileStat.mtime);

      if (fileModifiedTime > record.file_update_at) {
        return fileModifiedTime;
      }
    }
  } catch (error) {
    errorLogAdd(0, error, `${__filename}/getFileLatestTime`);
  }

  return record.file_update_at;
};

exports.getFileModifiedTime = filePath => {
  try {
    if (fs.existsSync(filePath)) {
      let fileStat = fs.statSync(filePath);
      return exports.convertToUTC(fileStat.mtime);
    }
  } catch (error) {
    errorLogAdd(0, error, `${__filename}/getFileModifiedTime`);
  }
  return 0;
};

exports.getFileLocalModifiedTime = filePath => {
  try {
    if (fs.existsSync(filePath)) {
      let fileStat = fs.statSync(filePath);
      return new Date(fileStat.mtime).getTime();
    }
  } catch (error) {
    errorLogAdd(0, error, `${__filename}/getFileLocalModifiedTime`);
  }
  return 0;
};

exports.getFileSize = filePath => {
  try {
    if (fs.existsSync(filePath)) {
      let fileStat = fs.statSync(filePath);
      return fileStat.size; // Size in bytes
    }
  } catch (error) {
    errorLogAdd(0, error, `${__filename}/getFileSize`);
  }
  return 0;
};

exports.convertToUTC = time => {
  return Math.round(Date.parse(new Date(time).toUTCString()));
};

exports.getCurrentTime = () => {
  return Math.round(new Date().getTime());
};

exports.getInstanceUrl = instance_url => {
  return instance_url.replace(/\/+$/, ""); // Replace any trailing slashes
};

exports.isStalledDownload = async record => {
  const now = exports.getCurrentTime();
  // Check if a file is stalled for more than 20 minutes
  if ((now - record.last_downloaded_at) / 60000 > 20) {
    return true;
  }
  return false;
};

exports.createItemOnLocal = async params => {
  const account = params.account;
  const watcher = params.watcher;
  const node = params.node;
  const currentPath = params.currentPath;
  let socketData = params.socketData || {};

  // If the Realtime notification couldnt send the data, we will rely on the onDemand helper
  if (!socketData.node_id) {
    socketData = {
      account_id: watcher.account_id,
      site_id: watcher.site_name,
      site_uuid: watcher.site_id,
      document_library_uuid: watcher.document_library_node,
      parent_id: node.parentId,
      node_id: node.id,
      path: `${node.path.name}/${node.name}`,
      is_file: node.isFile,
      is_folder: node.isFolder
    };
  }

  // Add to the watcher table
  let watchNode = socketData.node_id,
    watchFolder = socketData.path;

  if (socketData.is_file === true) {
    watchNode = socketData.parent_id;
    watchFolder = path.dirname(socketData.path);
  }

  try {
    await watcherModel.create({
      account_id: account.id,
      site_name: socketData.site_id,
      site_id: socketData.site_uuid,
      document_library_node: socketData.document_library_uuid,
      parent_node: socketData.parent_id,
      watch_node: watchNode,
      watch_folder: watchFolder
    });
  } catch (error) {}

  try {
    if (node.isFolder === true) {
      // If the child is a folder, create the folder first
      if (!fs.existsSync(currentPath)) {
        mkdirp.sync(currentPath);

        // Update the time meta properties of the downloaded file
        const btime = exports.convertToUTC(node.createdAt);
        const mtime = exports.convertToUTC(node.modifiedAt);
        const atime = undefined;

        setTimeout(() => {
          Utimes.utimes(currentPath, btime, mtime, atime, async () => {});
        }, 1000);
      }

      const nodeData = await nodeModel.findOne({
        where: {
          account_id: account.id,
          site_id: watcher.site_id,
          file_path: _path.toUnix(currentPath)
        }
      });

      // Only add a new data if the record does not exists
      if (!nodeData) {
        try {
          await nodeModel.create({
            account_id: account.id,
            site_id: watcher.site_id,
            node_id: node.id,
            remote_folder_path: node.path.name,
            file_name: path.basename(currentPath),
            file_path: _path.toUnix(currentPath),
            local_folder_path: _path.toUnix(path.dirname(currentPath)),
            file_update_at: exports.convertToUTC(node.modifiedAt),
            last_uploaded_at: 0,
            last_downloaded_at: exports.getCurrentTime(),
            is_folder: true,
            is_file: false,
            download_in_progress: false,
            upload_in_progress: false
          });
        } catch (error) {}
        return;
      }

      const { dataValues: nodeRecord } = { ...nodeData };

      // If there are any record that has the node_id missing, we will update it.
      if (nodeRecord.node_id === "") {
        await nodeModel.update(
          {
            node_id: node.id,
            remote_folder_path: node.path.name
          },
          {
            where: {
              account_id: account.id,
              site_id: watcher.site_id,
              file_path: _path.toUnix(currentPath)
            }
          }
        );
      }

      return;
    }

    // If the child is a file, download the file...
    if (node.isFile === true) {
      await remote.download({
        watcher,
        account,
        node,
        destinationPath: currentPath,
        remoteFolderPath: node.path.name
      });
    }
  } catch (error) {
    errorLogAdd(account.id, error, `${__filename}/createItemLocal`);
  }
};

exports.sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
