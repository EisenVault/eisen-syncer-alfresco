const { db } = require("../config/db");
const path = require("path");
const _ = require("lodash");
const LIMIT = 5;

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
  let fileName = params.fileName;
  let filePath = params.filePath;
  let fileUpdateAt = params.fileUpdateAt;
  let isFolder = params.isFolder;
  let isFile = params.isFile;

  let record = await this.getOne({
    account: account,
    nodeId: nodeId,
    filePath: filePath,
    fileUpdateAt: fileUpdateAt
  });

  if (record) {
    record = db("nodes")
      .update({
        file_update_at: fileUpdateAt
      })
      .where("file_update_at", "!=", fileUpdateAt)
      .where("account_id", account.id)
      .where("node_id", nodeId);

    return record;
  }

  try {
    return await db
      .insert({
        account_id: account.id,
        node_id: nodeId,
        file_name: fileName,
        file_path: filePath,
        folder_path: path.dirname(filePath),
        file_update_at: fileUpdateAt,
        is_folder: isFolder,
        is_file: isFile
      })
      .into("nodes");
  } catch (error) {
    console.log("An error occured while inserting data", error);
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

  return await db
    .select("file_update_at")
    .first()
    .from("nodes")
    .where("file_update_at", "!=", fileUpdateAt)
    .where("account_id", account.id)
    .where("node_id", nodeId);
};

/**
 * This method will return all the nodes that are not available in the DB.
 *
 *
 * @param object params
 * {
 *  account: <Object>,
 *  nodeList: <Array>
 * }
 */
exports.getMissingFiles = async params => {
  let account = params.account;
  let nodeList = params.nodeList;
  let folderPath = params.folderPath;

  return await db
    .whereNotIn("node_id", nodeList)
    .where("account_id", account.id)
    .where("folder_path", folderPath)
    .from("nodes");
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
exports.getNewFileList = async params => {
  let account = params.account;
  let localFilePathList = params.localFilePathList;

  console.log("COUNT:", localFilePathList.length);

  try {
    let existingRecords = [];
    let listCount = 0;
    console.log("localFilePathList.length", localFilePathList.length);

    while (listCount < localFilePathList.length) {
      existingRecords.concat(
        localFilePathList.slice(listCount, listCount + LIMIT)
      );
      listCount = listCount + LIMIT;
    }
    console.log("existingRecords", existingRecords);

    return;
    // let existingRecords = await db
    // .select("file_path")
    // .whereIn("file_path", localFilePathList)
    // .where("account_id", account.id)
    // .where("is_file", 1)
    // .from("nodes");

    let dbFilePathList = [];
    // Iterate through all the records and prepare a list of files that exists in the DB
    for (let record of existingRecords) {
      dbFilePathList.push(record.file_path);
    }

    return _.difference(localFilePathList, dbFilePathList);
  } catch (error) {
    console.log("getNewFileList:", error);

    return [];
  }
};

/**
 * This method will return a list of files that are deleted on the local machine.
 *
 * @param object params
 * {
 *  account: <Object>,
 *  localFilePathList: <Array>
 * }
 */
exports.getDeletedNodeList = async params => {
  let account = params.account;
  let localFilePathList = params.localFilePathList;

  try {
    console.log(localFilePathList.length);

    let existingRecords = await db
      .select("node_id")
      .whereNotIn("file_path", localFilePathList)
      .where("account_id", account.id)
      .from("nodes");

    let dbFilePathList = [];
    // Iterate through all the records and prepare a list of files that exists in the DB
    for (let record of existingRecords) {
      dbFilePathList.push(record.node_id);
    }

    return dbFilePathList;
  } catch (error) {
    console.log("getDeletedNodeList Error : ", error);

    return [];
  }
};

/**
 *
 * @param object params
 * {
 *  account: <Object>
 *  rootNodeId: <String>
 *  localFilePath: <String>
 * }
 */
exports.getFolderNodeId = async params => {
  let account = params.account;
  let localFilePath = params.localFilePath;
  let nodeId = params.rootNodeId;

  let record = await db
    .first("node_id")
    .from("nodes")
    .where("account_id", account.id)
    .where("file_path", path.dirname(localFilePath));

  if (record) {
    return record.node_id;
  }

  return nodeId;
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

  await db("nodes")
    .where("account_id", account.id)
    .where("node_id", nodeId)
    .delete();
};
