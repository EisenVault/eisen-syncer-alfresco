const fs = require("fs");
const { accountModel } = require("../../models/account");
const { watcherModel } = require("../../models/watcher");
const { workerModel } = require("../../models/worker");
const remote = require('../remote');
const { add: errorLogAdd } = require("../../models/log-error");

/**
 * Puts the process to sleep for the mentioned number of milliseconds
 *
 * @param integer milliseconds
 * @return void
 */
exports.sleep = (milliseconds = 1000) => {
  // return new Promise(resolve => setTimeout(resolve, milliseconds));
  let start = new Date().getTime();
  for (let i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds) {
      break;
    }
  }
}

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
  return Math.round(Date.parse(new Date(time).toUTCString()));
};

exports.getCurrentTime = () => {
  return Math.round(new Date().getTime());
};

exports.getRelativePath = params => {
  let { account, node } = params;

  // remove the account sync path and any starting slash
  return node.replace(account.sync_path, "").replace(/[\/|\\]/, "");
};


exports.runWorker = async () => {

  let workerData = await workerModel.findOne();

  if (!workerData) {
    return;
  }

  const { dataValues: worker } = workerData;

  const accountData = await accountModel.findByPk(worker.account_id);
  const { dataValues: account } = { ...accountData };

  const watcherData = await watcherModel.findByPk(worker.watcher_id);
  const { dataValues: watcher } = { ...watcherData };

  try {
    await remote.upload({
      account,
      watcher,
      filePath: worker.file_path,
      rootNodeId: watcher.document_library_node
    });

    // Delete the record after file uploaded
    await workerModel.destroy({
      where: {
        id: worker.id
      }
    });

    // Upload the next record
    exports.runWorker();

  } catch (error) {
    console.log('error', error);
    errorLogAdd(account.id, error, `${__filename}/runWorker`);
    // Delete the record anyway so that it can be re inserted later
    await workerModel.destroy({
      where: {
        id: worker.id
      }
    });
  }


}