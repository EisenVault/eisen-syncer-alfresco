const { db } = require("../config/db");

exports.getAllByAccountId = async accountId => {
  try {
    return await db
      .select("*")
      .from("watchers")
      .where("account_id", accountId);
  } catch (error) {
    return [{}];
  }
};

exports.addWatcher = async request => {
  return await db
    .insert({
      account_id: request.body.account_id,
      site_name: request.body.site_name,
      document_library_node: request.body.document_library_node,
      watch_node: request.body.watch_node,
      watch_folder: request.body.watch_folder,
    })
    .into("watchers");
};


exports.deleteAllByAccountId = async accountId => {
  await db
    .from("watchers")
    .where("account_id", accountId)
    .delete();
}

