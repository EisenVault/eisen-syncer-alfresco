const path = require("path");

exports.toUnix = path => {
  // Replace windows folder separator with unix style seperator
  return path.replace(/\\/g, "/");
};

// Returns the site-name from a local path
exports.getSiteNameFromPath = filePath => {
  let explode = filePath.split(exports.toUnix(path.sep));
  explode = explode.splice(explode.indexOf("documentLibrary") - 1, 1);
  return explode[0] || "";
};

exports.getRelativePath = params => {
  let { account, node } = params;
  // remove the account sync path and any starting slash
  return node.replace(account.sync_path, "").replace(/[\/|\\]/, "");
};

/**
 * Converts the node path to an equivilant local path
 * Eg: Converts
 * /Company Home/Sites/test-01/documentLibrary/0001.jpg
 * to
 * /home/test-01/documentLibrary/0001.jpg
 */
exports.getLocalPathFromNodePath = params => {
  const { account, nodePath } = params;
  const explode = nodePath.split("/");
  const sitename = explode.splice(explode.indexOf("documentLibrary") - 1, 1)[0];
  const relevantPath = nodePath
    .substring(nodePath.indexOf(`${sitename}/documentLibrary`))
    .replace("/Company Home/Sites/", "");

  return exports.toUnix(path.join(account.sync_path, relevantPath));
};

/**
 * Converts the local path to an equivilant remote path
 * Eg: Converts
 * /home/test-01/documentLibrary/0001.jpg
 * to
 * /Company Home/Sites/test-01/documentLibrary/0001.jpg
 */
exports.getRemotePathFromLocalPath = params => {
  const { account, localPath } = params;
  const explode = localPath.split("/");
  const sitename = explode.splice(explode.indexOf("documentLibrary") - 1, 1)[0];
  const relevantPath = localPath
    .substring(localPath.indexOf(`${sitename}/documentLibrary`))
    .replace(account.sync_path, "");

  return exports.toUnix(path.join("/Company Home/Sites/", relevantPath));
};
