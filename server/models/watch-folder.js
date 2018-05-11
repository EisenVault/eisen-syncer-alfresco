const { db } = require("../config/db");

exports.getNodes = async account => {
  return await db
    .select("node_id")
    .from("watch_folders")
    .where("account_id", account.id);
};
