const { db } = require("../config/db");
const crypt = require("../config/crypt");

exports.getAll = async () => {
  return await db
    .select(
      "id",
      "instance_url",
      "username",
      "sync_path",
      "sync_on",
      "sync_frequency",
      "overwrite"
    )
    .from("accounts");
};

exports.getOne = async id => {
  return await db
    .select(
      "instance_url",
      "username",
      "sync_path",
      "sync_on",
      "sync_frequency",
      "overwrite"
    )
    .first()
    .from("accounts")
    .where("id", id);
};

exports.getOneByAccountId = async id => {
  return await db
    .select("*")
    .first()
    .from("accounts")
    .where("id", id);
};

exports.findByInstance = async (instance_url, username) => {
  return await db
    .select("*")
    .first()
    .from("accounts")
    .where("instance_url", instance_url)
    .where("username", username);
};

exports.addAccount = async request => {
  return await db
    .insert({
      instance_url: request.body.instance_url,
      username: request.body.username,
      password: crypt.encrypt(request.body.password),
      sync_path: request.body.sync_path,
      sync_on: request.body.sync_on,
      sync_frequency: request.body.sync_frequency,
      overwrite: request.body.overwrite,
      created_at: new Date().getTime(),
      updated_at: new Date().getTime()
    })
    .into("accounts");
};

exports.updateAccount = async (accountId, request) => {
  return await db("accounts")
    .update({
      instance_url: request.body.instance_url,
      username: request.body.username,
      password: crypt.encrypt(request.body.password),
      sync_path: request.body.sync_path,
      sync_on: request.body.sync_on,
      sync_frequency: request.body.sync_frequency,
      overwrite: request.body.overwrite,
      updated_at: new Date().getTime()
    })
    .where("id", accountId);
};

exports.updateSync = async (accountId, request) => {
  return await db("accounts")
    .update({
      sync_on: request.body.sync_on,
      updated_at: new Date().getTime()
    })
    .where("id", accountId);
};

exports.updateSyncTime = async accountId => {
  return await db("accounts")
    .update({
      last_synced_at: new Date().getTime()
    })
    .where("id", accountId);
};

exports.deleteAccount = async accountId => {
  return await db("accounts")
    .delete()
    .where("id", accountId);
};
