const fs = require("fs");
const _path = require("../path");
const path = require("path");
const mkdirp = require("mkdirp");
const { nodeModel } = require("../../models/node");
const remote = require("../remote");
const { add: errorLogAdd } = require("../../models/log-error");
const Utimes = require('@ronomon/utimes');

/**
 * Returns the latest modified date between the physical file vs its record in db.
 *
 * @param object record
 * {
 *  record: <Object>
 * }
 */
exports.getFileLatestTime = record => {
  if (fs.existsSync(record.file_path)) {
    let fileStat = fs.statSync(record.file_path);
    let fileModifiedTime = exports.convertToUTC(fileStat.mtime.toUTCString());

    if (fileModifiedTime > record.file_update_at) {
      return fileModifiedTime;
    }
  }

  return record.file_update_at;
};

exports.getFileModifiedTime = filePath => {
  if (fs.existsSync(filePath)) {
    let fileStat = fs.statSync(filePath);
    return exports.convertToUTC(fileStat.mtime.toUTCString());
  }
  return 0;
};

exports.getFileSize = filePath => {
  if (fs.existsSync(filePath)) {
    let fileStat = fs.statSync(filePath);
    return fileStat.size; // Size in bytes
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
  // If the file is downloading more then 5 minutes, then delete the record as it looks like a dead record or download stalled
  if (((now - record.last_downloaded_at) / 60000) > 5) {
    await nodeModel.update({
      download_in_progress: false
    }, {
        where: {
          id: record.id
        }
      });
    return true;
  }

  return false;
}

exports.createItemOnLocal = async params => {
  const account = params.account;
  const watcher = params.watcher;
  const node = params.node;
  const currentPath = params.currentPath;
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
          Utimes.utimes(currentPath, btime, mtime, atime, async () => { });
        }, 1000);
      }

      // Delete if record already exists
      await nodeModel.destroy({
        where: {
          account_id: account.id,
          site_id: watcher.site_id,
          node_id: node.id,
          file_path: _path.toUnix(currentPath),
        }
      });

      // Add reference to the nodes table
      await nodeModel.create({
        account_id: account.id,
        site_id: watcher.site_id,
        node_id: node.id,
        remote_folder_path: node.path.name,
        file_name: path.basename(currentPath),
        file_path: _path.toUnix(currentPath),
        local_folder_path: path.dirname(currentPath),
        file_update_at: exports.convertToUTC(node.modifiedAt),
        last_uploaded_at: 0,
        last_downloaded_at: exports.getCurrentTime(),
        is_folder: true,
        is_file: false,
        download_in_progress: 0,
        upload_in_progress: 0
      });
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