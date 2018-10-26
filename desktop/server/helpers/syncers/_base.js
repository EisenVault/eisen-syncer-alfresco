const fs = require("fs");

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
  return Math.round(Date.parse(new Date(time).toUTCString()) / 1000);
};

exports.getCurrentTime = () => {
  return Math.round(new Date().getTime() / 1000);
};


exports.getRelativePath = params => {

  let { account, node } = params;

  // remove the account sync path and any starting slash
  return node.replace(account.sync_path, '').replace(/[\/|\\]/, '');
}