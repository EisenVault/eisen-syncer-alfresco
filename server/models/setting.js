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

exports.startupLaunch = async () => {
  return await db
    .select("value")
    .first()
    .from("settings")
    .where("name", "LAUNCH_AT_STARTUP");
};

exports.isNewInstallation = async () => {
  return await db
    .select("value")
    .first()
    .from("settings")
    .where("name", "NEW_INSTALLATION");
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
