const { db } = require("../config/db");

exports.getNodes = async accountId => {
  return await db
    .select("*")
    .from("watch_folders")
    .where("account_id", accountId);
};

exports.add = async (account_id, node_id) => {
  return await db
    .insert({
      account_id: account_id,
      node_id: node_id
    })
    .into("watch_folders");
};

exports.delete = async accountId => {
  return await db("watch_folders")
    .where("account_id", accountId)
    .delete();
};
