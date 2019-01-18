const fs = require("fs");
const _path = require("../path");
const path = require("path");
const mkdirp = require("mkdirp");
const { nodeModel } = require("../../models/node");
const remote = require("../remote");
const { add: errorLogAdd } = require("../../models/log-error");

/**
 * Puts the process to sleep for the mentioned number of milliseconds
 *
 * @param integer milliseconds
 * @return void
 */
exports.sleep = (milliseconds = 1000) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
  // let start = new Date().getTime();
  // for (let i = 0; i < 1e7; i++) {
  //   if ((new Date().getTime() - start) > milliseconds) {
  //     break;
  //   }
  // }
}

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

/**
 *
 * @param object filePath
 * {
 *  filePath: <String>
 * }
 */
exports.getFileModifiedTime = filePath => {
  if (fs.existsSync(filePath)) {
    let fileStat = fs.statSync(filePath);
    return exports.convertToUTC(fileStat.mtime.toUTCString());
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