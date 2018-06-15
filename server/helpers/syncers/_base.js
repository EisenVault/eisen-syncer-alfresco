const fs = require("fs");

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
    return Math.round(
      Date.parse(new Date(String(fileStat.mtime)).toUTCString()) / 1000
    );
  }
  return 0;
};