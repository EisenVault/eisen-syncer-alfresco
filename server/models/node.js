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
  await db("nodes")
    .where("account_id", account.id)
    .where("file_path", filePath)
    .delete();

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
    errorLogModel.add(account, error);
  }
};

exports.getOneByFilePath = async params => {
  let account = params.account;
  let filePath = params.filePath;

  return await db
    .select("*")
    .first()
    .from("nodes")
    .where("account_id", account.id)
    .where("file_path", filePath);
};

exports.getOneByNodeId = async params => {
  let account = params.account;
  let nodeId = params.nodeId;

  return await db
    .select("*")
    .first()
    .from("nodes")
    .where("account_id", account.id)
    .where("node_id", nodeId);
};

exports.getAllByFileOrFolderPath = async params => {
  let account = params.account;
  let path = params.path;

  return await db
    .select("*")
    .from("nodes")
    .where("account_id", account.id)
    .where("file_path", "LIKE", path + "%")
    .orWhere("folder_path", "LIKE", path + "%");
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

  return await db
    .select("file_update_at")
    .first()
    .from("nodes")
    .where("file_update_at", "!=", fileUpdateAt)
    .where("account_id", account.id)
    .where("node_id", nodeId);
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

  return await db
    .select("*")
    .from("nodes")
    .where("account_id", account.id)
    .where("folder_path", folderPath);
};

/**
 * This method will return all the nodes that are not available in the DB.
 *
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

  let missingFiles = [];
  let listCount = 0;
  while (listCount <= fileList.length) {
    let chunk = fileList.slice(listCount, listCount + LIMIT);

    let result = await db
      .pluck("file_path")
      .whereNotIn("file_path", chunk)
      .where("account_id", account.id)
      .from("nodes");

    missingFiles = missingFiles.concat(result);

    listCount = listCount + LIMIT;
  }

  return missingFiles;
};

/**
 * This method will return a list of files that are not in DB records, which means those files were locally created and needs to be uploaded to the server.
 *
 * @param object params
 * {
 *  account: <Object>,
 *  fileList: <Array>
 * }
 */
// exports.getNewFileList = async params => {
//   let account = params.account;
//   let localFilePathList = params.localFilePathList;

//   try {
//     let existingRecords = [];
//     let listCount = 0;
//     while (listCount <= localFilePathList.length) {
//       let chunk = localFilePathList.slice(listCount, listCount + LIMIT);

//       let result = await db
//         .select("file_path")
//         .whereIn("file_path", chunk)
//         .where("account_id", account.id)
//         .where("is_file", 1)
//         .from("nodes");

//       existingRecords = existingRecords.concat(result);

//       listCount = listCount + LIMIT;
//     }

//     let dbFilePathList = [];
//     // Iterate through all the records and prepare a list of files that exists in the DB
//     for (let record of existingRecords) {
//       dbFilePathList.push(record.file_path);
//     }

//     return _.difference(localFilePathList, dbFilePathList);
//   } catch (error) {
//     console.log("getNewFileList:", error);

//     return [];
//   }
// };

/**
 * This method will return a list of files that are deleted on the local machine.
 *
 * @param object params
 * {
 *  account: <Object>,
 *  localFilePathList: <Array>
 * }
 */
// exports.getDeletedNodeList = async params => {
//   let account = params.account;
//   let localFilePathList = params.localFilePathList;

//   try {
//     let existingRecords = [];
//     let listCount = 0;
//     while (listCount <= localFilePathList.length) {
//       let chunk = localFilePathList.slice(listCount, listCount + LIMIT);

//       let result = await db
//         .select("node_id")
//         .whereNotIn("file_path", chunk)
//         .where("account_id", account.id)
//         .from("nodes");

//       existingRecords = existingRecords.concat(result);
//       listCount = listCount + LIMIT;
//     }

//     let dbFilePathList = [];
//     // Iterate through all the records and prepare a list of files that exists in the DB
//     for (let record of existingRecords) {
//       dbFilePathList.push(record.node_id);
//     }

//     return dbFilePathList;
//   } catch (error) {
//     errorLogModel.add(account, error);
//     return [];
//   }
// };

/**
 *
 * @param object params
 * {
 *  account: <Object>
 *  rootNodeId: <String>
 *  localFilePath: <String>
 * }
 */
// exports.getFolderNodeId = async params => {
//   let account = params.account;
//   let localFilePath = params.localFilePath;
//   let nodeId = params.rootNodeId;

//   let record = await db
//     .first("node_id")
//     .from("nodes")
//     .where("account_id", account.id)
//     .where("file_path", path.dirname(localFilePath));

//   if (record) {
//     return record.node_id;
//   }

//   return nodeId;
// };

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

  await db("nodes")
    .where("account_id", account.id)
    .where("node_id", nodeId)
    .delete();
};

/**
 *
 * @param object params
 * {
 *  account: <Object>,
 *  nodeId: <String>
 * }
 */
// exports.deleteByFolderPath = async params => {
//   let account = params.account;
//   let folderPath = params.folderPath;

//   await db("nodes")
//     .where("account_id", account.id)
//     .where("folder_path", folderPath)
//     .delete();
// };
