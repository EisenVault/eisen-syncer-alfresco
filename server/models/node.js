const { db } = require("../config/db");
const path = require("path");
const errorLogModel = require("./log-error");
const _ = require("lodash");
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
  let account = params.account;
  let nodeId = params.nodeId;
  let filePath = params.filePath;
  let fileUpdateAt = params.fileUpdateAt;
  let isFolder = params.isFolder;
  let isFile = params.isFile;

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
        node_id: nodeId,
        file_name: path.basename(filePath),
        file_path: filePath,
        folder_path: path.dirname(filePath),
        file_update_at: fileUpdateAt,
        is_folder: isFolder,
        is_file: isFile
      })
      .into("nodes");
  } catch (error) {
    await  errorLogModel.add(account, error);
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
      .where("node_id", nodeId);
  } catch (error) {
    return await errorLogModel.add(account, error);
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
      .where("file_path", "LIKE", path + "%")
      .orWhere("folder_path", path);
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
      .where("folder_path", folderPath);
  } catch (error) {
    await errorLogModel.add(account, error);
  }
};

/**
 * This method will return all the records that are not available in the DB.
 *
 * @param object params
 * {
 *  account: <Object>,
 *  fileList: <Array>
 * }
 */
exports.getMissingFiles = async params => {
  let account = params.account;
  let fileList = params.fileList;
  let column = params.column || 'file_path'

  let missingFiles = [];
  let listCount = 0;
  while (listCount <= fileList.length) {
    let chunk = fileList.slice(listCount, listCount + LIMIT);

    try {
      let result = await db
        .pluck(column)
        .whereNotIn("file_path", chunk)
        .where("account_id", account.id)
        .from("nodes");

      missingFiles = missingFiles.concat(result);
      listCount = listCount + LIMIT;
    } catch (error) {
      await errorLogModel.add(account, error);
    }
  }

  return missingFiles;
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
      .delete();
  } catch (error) {
    await  errorLogModel.add(account, error);
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
      .delete();
  } catch (error) {
    await  errorLogModel.add(account, error);
  }
};

exports.deleteAllByFileOrFolderPath = async params => {
  let account = params.account;
  let path = params.path;

  try {
    return await db("nodes")
      .where("account_id", account.id)
      .where("file_path", "LIKE", path + "%")
      .orWhere("folder_path", path)
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
exports.deleteAll = async params => {
  let account = params.account;

  try {
    await db("nodes")
      .where("account_id", account.id)
      .delete();
  } catch (error) {
    await errorLogModel.add(account, error);
  }
};
