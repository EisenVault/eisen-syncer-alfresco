const { db } = require("../config/db");

exports.getAll = async () => {
  return await db.select("*").from("settings");
};

exports.getOne = async name => {
  return await db
    .select("*")
    .first()
    .from("settings")
    .where("name", name);
};

exports.add = async request => {
  return await db
    .insert({
      name: request.body.name,
      value: request.body.value
    })
    .into("settings");
};

exports.update = async (name, request) => {
  return await db("settings")
    .update({
      value: request.body.value
    })
    .where("name", name);
};
