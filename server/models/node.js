const { db } = require("../config/db");

/**
 *
 * @param object params
 * {
 *  accountId: '',
 *  nodeId: '',
 *  fileName: '',
 *  localPath: '',
 *  fileUpdateAt: '',
 *  isFolder: '',
 *  isFile: '',
 * }
 */
exports.add = async params => {
  let accountId = params.accountId;
  let nodeId = params.nodeId;
  let fileName = params.fileName;
  let localPath = params.localPath;
  let fileUpdateAt = params.fileUpdateAt;
  let isFolder = params.isFolder;
  let isFile = params.isFile;

  let record = await this.getOne({
    accountId: accountId,
    nodeId: nodeId,
    localPath: localPath,
    fileUpdateAt: fileUpdateAt
  });

  if (record) {
    record = db("nodes")
      .update({
        file_update_at: fileUpdateAt
      })
      .where("file_update_at", "!=", fileUpdateAt)
      .where("account_id", accountId)
      .where("node_id", nodeId)
      .where("local_path", localPath);

    return record;
  }

  return await db
    .insert({
      account_id: accountId,
      node_id: nodeId,
      file_name: fileName,
      local_path: localPath,
      file_update_at: fileUpdateAt,
      is_folder: isFolder,
      is_file: isFile
    })
    .into("nodes");
};

/**
 *
 * @param object params
 * {
 *  accountId: '',
 *  nodeId: '',
 *  localPath: '',
 *  fileUpdateAt: '',
 * }
 */
exports.getOne = async params => {
  let accountId = params.accountId;
  let nodeId = params.nodeId;
  let localPath = params.localPath;
  let fileUpdateAt = params.fileUpdateAt;

  return await db
    .select("file_update_at")
    .first()
    .from("nodes")
    .where("file_update_at", "!=", fileUpdateAt)
    .where("account_id", accountId)
    .where("node_id", nodeId)
    .where("local_path", localPath);
};

/**
 *
 * @param object params
 * {
 *  accountId: '',
 *  nodeList: '',
 * }
 */
exports.getMissingFiles = async params => {
  let nodeList = params.nodeList;
  let accountId = params.accountId;

  return await db
    .whereNotIn("node_id", nodeList)
    .where("account_id", accountId)
    .from("nodes");
};
