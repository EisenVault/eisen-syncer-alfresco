const fs = require("fs");
const _path = require("../path");
const path = require("path");
const mkdirp = require("mkdirp");
const { nodeModel } = require("../../models/node");
const remote = require("../remote");
const { add: errorLogAdd } = require("../../models/log-error");
const Utimes = require('@ronomon/utimes');
const { eventLogModel, types: eventType } = require("../../models/log-event");

exports.deferFileUpdate = async (uri, delay = 3000) => {
  setTimeout(async () => {
    const { destinationPath, remoteFolderPath, account, node, watcher } = JSON.parse(decodeURIComponent(uri));

    // Update the time meta properties of the downloaded file
    const btime = exports.convertToUTC(node.createdAt);
    const mtime = exports.convertToUTC(node.modifiedAt);
    const atime = undefined;

    Utimes.utimes(destinationPath, btime, mtime, atime, async (error) => {
      if (error) {
        errorLogAdd(account.id, error, `${__filename}/download_utimeerror`);
        return;
      }

      if (mtime != exports.getFileModifiedTime(destinationPath)) {
        exports.deferFileUpdate(uri, delay * 2);
        return;
      }

      // set download progress to false
      await nodeModel.upsert({
        account_id: account.id,
        site_id: watcher.site_id,
        node_id: node.id,
        remote_folder_path: remoteFolderPath,
        file_name: path.basename(destinationPath),
        file_path: _path.toUnix(destinationPath),
        local_folder_path: path.dirname(destinationPath),
        file_update_at: mtime,
        last_uploaded_at: 0,
        last_downloaded_at: exports.getCurrentTime(),
        is_folder: false,
        is_file: true,
        download_in_progress: false,
        upload_in_progress: false
      },
        {
          account_id: account.id,
          site_id: watcher.site_id,
          node_id: node.id,
          file_path: _path.toUnix(destinationPath),
        });

      console.log(`Downloaded File: ${destinationPath} from ${account.instance_url}`);

      // Add an event log
      await eventLogModel.create({
        account_id: account.id,
        type: eventType.DOWNLOAD_FILE,
        description: `Downloaded File: ${destinationPath} from ${account.instance_url}`,
      });
    });
  }, delay);
}

exports.deferFileModifiedDate = (params, delay = 2000, callback) => {
  const { filePath, btime, mtime, atime } = params;
  setTimeout(() => {
    Utimes.utimes(filePath, btime, mtime, atime, async () => {
      if (mtime != exports.getFileModifiedTime(filePath)) {
        exports.deferFileModifiedDate(params, delay * 2);
        return;
      }
      callback(true);
    })
  }, delay);
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
  // Check if a file is stalled for more than 20 minutes
  if (((now - record.last_downloaded_at) / 60000) > 20) {
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



exports.sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
