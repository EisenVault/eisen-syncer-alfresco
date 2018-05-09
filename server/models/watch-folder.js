const { db } = require("../config/db");

exports.getNodes = async accountId => {
  return await db.select("folder_node_id").from("watch_folders");
};
