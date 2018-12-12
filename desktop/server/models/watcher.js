const { db } = require("../config/db");
const errorLogModel = require('../models/log-error');

exports.getAllByAccountId = async accountId => {
  return await db
    .select(["watchers.*",
      "accounts.instance_url",
      "accounts.sync_path",
      "accounts.sync_enabled",
      "accounts.last_synced_at",
      "accounts.sync_in_progress",
      "accounts.download_in_progress",
      "accounts.upload_in_progress"
    ])
    .from("watchers")
    .where("account_id", accountId)
    .join('accounts', 'accounts.id', 'watchers.account_id');
};

exports.addWatcher = async (accountId, object) => {

  db.transaction(async (trx) => {
    try {
      const result = await db
        .insert({
          account_id: accountId,
          site_name: object.siteName,
          site_id: object.siteId,
          document_library_node: object.documentLibraryId,
          watch_node: object.watchNodeId,
          watch_folder: object.watchPath,
        })
        .into("watchers")
        .transacting(trx);
      trx.commit;
      return result;

    } catch (error) {
      trx.rollback;
      await errorLogModel.add(account, error);
    }

  });

};


exports.deleteAllByAccountId = async accountId => {

  db.transaction(async (trx) => {
    try {
      await db
        .from("watchers")
        .where("account_id", accountId)
        .delete()
        .transacting(trx);
      trx.commit;

    } catch (error) {
      trx.rollback;
      await errorLogModel.add(account, error);
    }
  });

}

