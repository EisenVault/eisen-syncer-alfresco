const { db } = require("../config/db");

exports.getNodes = async accountId => {
  return await db
    .select("*")
    .from("watch_folders")
    .where("account_id", accountId);
};

exports.add = async (accountId, nodeId) => {
  return await db
    .insert({
      account_id: accountId,
      node_id: nodeId
    })
    .into("watch_folders");
};

exports.delete = async accountId => {
  return await db("watch_folders")
    .where("account_id", accountId)
    .delete();
};
