const { db } = require("../config/db");
const path = require("path");
const errorLogModel = require("./log-error");
const _ = require("lodash");
const { logger } = require('../helpers/logger');
const LIMIT = 950;

/**
 *
 * @param object params
 * {
 *  account: <Object>,
 *  nodeId: <String>,
 *  fileName: <String>,
 *  filePath: <String>,
 *  fileUpdateAt: <Integer>,
 *  isFolder: <Boolean>,
 *  isFile: <Boolean>
 * }
 */
exports.add = async params => {
  const account = params.account;
  const watcher = params.watcher;
  const nodeId = params.nodeId;
  const remoteFolderPath = params.remoteFolderPath;
  const filePath = params.filePath;
  const fileUpdateAt = params.fileUpdateAt || 0;
  const lastUploadedAt = params.lastUploadedAt || 0;
  const lastDownloadedAt = params.lastDownloadedAt || 0;
  const isFolder = params.isFolder;
  const isFile = params.isFile;

  // Delete the record if it already exists
  try {
    await db("nodes")
      .where("account_id", account.id)
      .where("file_path", filePath)
      .delete();
  } catch (error) {
    await errorLogModel.add(account, error);
  }

  try {
    // If its a new record, simply add it
    return await db
      .insert({
        account_id: account.id,
        site_id: watcher.site_id,
        node_id: nodeId,
        remote_folder_path: remoteFolderPath,
        file_name: path.basename(filePath),
        file_path: filePath,
        local_folder_path: path.dirname(filePath),
        file_update_at: fileUpdateAt,
        last_uploaded_at: lastUploadedAt,
        last_downloaded_at: lastDownloadedAt,
        is_folder: isFolder,
        is_file: isFile,
        is_deleted: 0
      })
      .into("nodes");
  } catch (error) {
    await errorLogModel.add(account, error);
  }
};

exports.getOneByFilePath = async params => {
  let account = params.account;
  let filePath = params.filePath;

  try {
    return await db
      .select("*")
      .first()
      .from("nodes")
      .where("is_deleted", 0)
      .where("account_id", account.id)
      .where("file_path", filePath);
  } catch (error) {
    return await errorLogModel.add(account, error);
  }
};

exports.getOneByNodeId = async params => {
  let account = params.account;
  let nodeId = params.nodeId;

  try {
    return await db
      .select("*")
      .first()
      .from("nodes")
      .where("account_id", account.id)
      .where("is_deleted", 0)
      .where("node_id", nodeId);
  } catch (error) {
    return await errorLogModel.add(account, error);
  }
};

exports.getAll = async params => {
  let account = params.account;

  try {
    return await db
      .select("*")
      .from("nodes")
      .where("account_id", account.id)
      .where("is_deleted", 0);
  } catch (error) {
    await errorLogModel.add(account, error);
  }
};

exports.getAllByNodeId = async nodeId => {
  try {
    return await db
      .select("*")
      .from("nodes")
      .where("node_id", nodeId)
      .where("is_deleted", 0);
  } catch (error) {
    await errorLogModel.add(account, error);
  }
};

exports.getAllByFileOrFolderPath = async params => {
  let account = params.account;
  let path = params.path;

  try {
    return await db
      .select("*")
      .from("nodes")
      .where("account_id", account.id)
      .where("is_deleted", 0)
      .where("file_path", "LIKE", path + "%")
      .orWhere("local_folder_path", path);
  } catch (error) {
    await errorLogModel.add(account, error);
  }
};

/**
 *
 * @param object params
 * {
 *  account: <Object>,
 *  nodeId: <String>,
 *  filePath: <String>,
 *  fileUpdateAt: <Integer>
 * }
 */
exports.getOne = async params => {
  let account = params.account;
  let nodeId = params.nodeId;
  let fileUpdateAt = params.fileUpdateAt;

  try {
    return await db
      .select("file_update_at")
      .first()
      .from("nodes")
      .where("file_update_at", "!=", fileUpdateAt)
      .where("account_id", account.id)
      .where("is_deleted", 0)
      .where("node_id", nodeId);
  } catch (error) {
    await errorLogModel.add(account, error);
  }
};

/**
 * @param object params
 * {
 *  account: <Object>,
 *  folderPath: <String>,
 * }
 */
exports.getAllByFolderPath = async params => {
  let account = params.account;
  let folderPath = params.folderPath;

  try {
    return await db
      .select("*")
      .from("nodes")
      .where("account_id", account.id)
      .where("is_deleted", 0)
      .where("local_folder_path", folderPath);
  } catch (error) {
    await errorLogModel.add(account, error);
  }
};

/**
 * This method will return all the records that are not available in the DB.
 * Meaning these files were deleted from the server but are present in local and hence needs to be deleted.
 *
 * @param object params
 * {
 *  account: <Object>,
 *  fileList: <Array>
 * }
 */
exports.getMissingFiles = async params => {
  const account = params.account;
  const watcher = params.watcher;
  const fileList = params.fileList;

  let missingFiles = [];
  let listCount = 0;
  while (listCount <= fileList.length) {
    let chunk = fileList.slice(listCount, listCount + LIMIT);

    try {
      let result = await db
        .select(["node_id", "file_path"])
        .whereNotIn("file_path", chunk)
        .where("account_id", account.id)
        .where("site_id", watcher.site_id)
        .where("is_deleted", 0)
        .from("nodes");

      missingFiles = missingFiles.concat(result);
      listCount = listCount + LIMIT;
    } catch (error) {
      await errorLogModel.add(account, error);
    }
  }

  return missingFiles;
};

exports.updateModifiedTime = async params => {
  let account = params.account;
  let filePath = params.filePath;
  let fileUpdateAt = params.fileUpdateAt;

  try {
    return await db("nodes")
      .update({
        file_update_at: fileUpdateAt
      })
      .where("account_id", account.id)
      .where("file_path", filePath);
  } catch (error) {
    return await errorLogModel.add(account, error);
  }
};

/**
 *
 * @param object params
 * {
 *  account: <Object>,
 *  nodeId: <String>
 * }
 */
exports.delete = async params => {
  let account = params.account;
  let nodeId = params.nodeId;

  try {
    await db("nodes")
      .where("account_id", account.id)
      .where("node_id", nodeId)
      .update({
        is_deleted: 1
      });
  } catch (error) {
    await errorLogModel.add(account, error);
  }
};

/**
 *
 * @param object params
 * {
 *  account: <Object>,
 *  filePath: <String>
 * }
 */
exports.deleteByPath = async params => {
  let account = params.account;
  let filePath = params.filePath;

  try {
    await db("nodes")
      .where("account_id", account.id)
      .where("file_path", filePath)
      .update({
        is_deleted: 1
      });
  } catch (error) {
    await errorLogModel.add(account, error);
  }
};

exports.deleteAllByFileOrFolderPath = async params => {
  let account = params.account;
  let path = params.path;

  try {
    return await db("nodes")
      .where("account_id", account.id)
      .where("file_path", "LIKE", path + "%")
      .orWhere("local_folder_path", path)
      .update({
        is_deleted: 1
      });
  } catch (error) {
    await errorLogModel.add(account, error);
  }
};

exports.forceDeleteAllByFileOrFolderPath = async params => {
  let account = params.account;
  let path = params.path;

  try {
    return await db("nodes")
      .where("account_id", account.id)
      .where("file_path", "LIKE", path + "%")
      .orWhere("local_folder_path", path)
      .delete();
  } catch (error) {
    await errorLogModel.add(account, error);
  }
};

/**
 *
 * @param object params
 * {
 *  account: <Object>
 * }
 */
// exports.deleteAll = async params => {
//   let account = params.account;

//   try {
//     await db("nodes")
//       .where("account_id", account.id)
//       .update({
//         is_deleted: 1
//       });
//   } catch (error) {
//     await errorLogModel.add(account.id, error);
//   }
// };



/**
 *
 * @param object params
 * {
 *  account: <Object>,
 *  nodeId: <String>
 * }
 */
exports.forceDelete = async params => {
  let account = params.account;
  let nodeId = params.nodeId;

  try {
    await db("nodes")
      .where("account_id", account.id)
      .where("node_id", nodeId)
      .delete();
  } catch (error) {
    await errorLogModel.add(account, error);
  }
};

/**
 * Permanently delete all nodes by accountId
 *
 * @param object params
 * {
 *  account: <Object>
 * }
 */
exports.forceDeleteAll = async accountId => {
  try {
    await db("nodes")
      .where("account_id", accountId)
      .delete();
  } catch (error) {
    await errorLogModel.add(accountId, error);
  }
};
