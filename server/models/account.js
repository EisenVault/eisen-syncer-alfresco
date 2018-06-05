const { db } = require("../config/db");
const crypt = require("../config/crypt");

exports.getAll = async syncEnabled => {
  return await db
    .select(
      "id",
      "instance_url",
      "username",
      "sync_path",
      "sync_enabled",
      "sync_frequency",
      "sync_in_progress",
      "last_synced_at",
      "overwrite"
    )
    .modify(queryBuilder => {
      if (syncEnabled == 1) {
        queryBuilder.where("sync_enabled", 1);
      } else if (syncEnabled == 0) {
        queryBuilder.where("sync_enabled", 0);
      }
    })
    .from("accounts");
};

exports.getOne = async id => {
  return await db
    .select(
      "id",
      "instance_url",
      "username",
      "token",
      "sync_path",
      "sync_enabled",
      "sync_frequency",
      "sync_in_progress",
      "overwrite"
    )
    .first()
    .from("accounts")
    .where("id", id);
};

exports.getPassword = async id => {
  return await db
    .select("*")
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
      sync_enabled: request.body.sync_enabled,
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
      sync_enabled: request.body.sync_enabled,
      sync_frequency: request.body.sync_frequency,
      overwrite: request.body.overwrite,
      updated_at: new Date().getTime()
    })
    .where("id", accountId);
};

exports.updateSync = async (accountId, request) => {
  return await db("accounts")
    .update({
      sync_enabled: request.body.sync_enabled,
      sync_in_progress: 0,
      updated_at: new Date().getTime()
    })
    .where("id", accountId);
};

exports.syncStart = async accountId => {
  await db("accounts")
    .update({
      sync_in_progress: 1
    })
    .where("id", accountId);

  return await db
    .first()
    .from("accounts")
    .where("id", accountId);
};

exports.syncComplete = async accountId => {
  return await db("accounts")
    .update({
      sync_in_progress: 0,
      last_synced_at: new Date().getTime()
    })
    .where("id", accountId);
};

exports.updateToken = async (accountId, token) => {
  return await db("accounts")
    .update({
      token: token,
      updated_at: new Date().getTime()
    })
    .where("id", accountId);
};

exports.deleteAccount = async accountId => {
  return await db("accounts")
    .delete()
    .where("id", accountId);
};
