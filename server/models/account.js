const { db } = require("../config/db");

exports.getAll = async () => {
  return await db.select("instance_url").from("accounts");
};
