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
    return exports.convertToUTC(fileStat.mtime.toUTCString());
  }
  return 0;
};

exports.convertToUTC = time => {
  return Math.round(
    Date.parse(new Date(time).toUTCString()) / 1000
  );
}