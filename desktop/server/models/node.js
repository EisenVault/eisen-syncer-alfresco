const { db } = require("../config/db");
const path = require("path");
const errorLogModel = require("./log-error");
const _ = require("lodash");
const _path = require('../helpers/path');
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
  const filePath = _path.toUnix(params.filePath);
  const fileUpdateAt = params.fileUpdateAt || 0;
  const lastUploadedAt = params.lastUploadedAt || 0;
  const lastDownloadedAt = params.lastDownloadedAt || 0;
  const isFolder = params.isFolder;
  const isFile = params.isFile;

  // If its a new record, simply add it
  db.transaction(async (trx) => {

    try {
      // Delete the record if it already exists
      await db("nodes")
        .where("account_id", account.id)
        .where("file_path", filePath)
        .delete()
        .transacting(trx);

      const result = await db
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
        .into("nodes")
        .transacting(trx);
      trx.commit;
      return result;

    } catch (error) {
      trx.rollback;
      await errorLogModel.add(account, error);
    }

  });
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

exports.updateModifiedTime = async params => {
  let account = params.account;
  let filePath = params.filePath;
  let fileUpdateAt = params.fileUpdateAt;

  db.transaction(async trx => {
    try {
      const result = await db("nodes")
        .update({
          file_update_at: fileUpdateAt
        })
        .where("account_id", account.id)
        .where("file_path", filePath)
        .transacting(trx);
      trx.commit;
      return result;

    } catch (error) {
      trx.rollback;
      return await errorLogModel.add(account, error);
    }
  });
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

  db.transaction(async trx => {

    try {
      await db("nodes")
        .where("account_id", account.id)
        .where("node_id", nodeId)
        .update({
          is_deleted: 1
        })
        .transacting(trx);
      trx.commit;

    } catch (error) {
      trx.rollback;
      await errorLogModel.add(account, error);
    }
  });
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

  db.transaction(async trx => {

    try {
      await db("nodes")
        .where("account_id", account.id)
        .where("file_path", filePath)
        .update({
          is_deleted: 1
        })
        .transacting(trx);
      trx.commit;

    } catch (error) {
      trx.rollback;
      await errorLogModel.add(account, error);
    }
  });
};


/**
 *
 * @param object params
 * {
 *  account: <Object>,
 *  filePath: <String>
 * }
 */
exports.forceDeleteByPath = async params => {
  let account = params.account;
  let filePath = params.filePath;

  db.transaction(async trx => {

    try {
      await db("nodes")
        .where("account_id", account.id)
        .where("file_path", filePath)
        .delete()
        .transacting(trx);
      trx.commit;

    } catch (error) {
      trx.rollback;
      await errorLogModel.add(account, error, __filename);
    }
  });
};

exports.deleteAllByFileOrFolderPath = async params => {
  let account = params.account;
  let path = params.path;

  db.transaction(async trx => {
    try {
      const result = await db("nodes")
        .where("account_id", account.id)
        .where("file_path", "LIKE", path + "%")
        .orWhere("local_folder_path", path)
        .update({
          is_deleted: 1
        })
        .transacting(trx);
      trx.commit;
      return result;
    } catch (error) {
      trx.rollback;
      await errorLogModel.add(account, error);
    }
  });
};

exports.forceDeleteAllByFileOrFolderPath = async params => {
  let account = params.account;
  let path = params.path;

  db.transaction(async trx => {
    try {
      const result = await db("nodes")
        .where("account_id", account.id)
        .where("file_path", "LIKE", path + "%")
        .orWhere("local_folder_path", path)
        .delete()
        .transacting(trx);
      trx.commit;
      return result;
    } catch (error) {
      trx.rollback;
      await errorLogModel.add(account, error);
    }
  });
};

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

  db.transaction(async trx => {
    try {
      await db("nodes")
        .where("account_id", account.id)
        .where("node_id", nodeId)
        .delete()
        .transacting(trx);
      trx.commit;

    } catch (error) {
      trx.rollback;
      await errorLogModel.add(account, error);
    }
  });
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
  db.transaction(async trx => {
    try {
      await db("nodes")
        .where("account_id", accountId)
        .delete()
        .transacting(trx);
      trx.commit;
    } catch (error) {
      trx.rollback;
      await errorLogModel.add(accountId, error);
    }
  });
};
