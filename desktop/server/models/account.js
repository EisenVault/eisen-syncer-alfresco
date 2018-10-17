const { db } = require("../config/db");
const crypt = require("../config/crypt");

exports.getAll = async (syncEnabled, isDeleted = 0) => {
  try {
    return await db
      .select(
        "id",
        "instance_url",
        "username",
        "watch_node",
        "watch_folder",
        "sync_path",
        "sync_enabled",
        "sync_frequency",
        "sync_in_progress",
        "last_synced_at"
      )
      .modify(queryBuilder => {
        if (syncEnabled == 1) {
          queryBuilder.where("sync_enabled", 1);
        } else if (syncEnabled == 0) {
          queryBuilder.where("sync_enabled", 0);
        }
      })
      .from("accounts")
      .where('is_deleted', isDeleted);
  } catch (error) {
    return [{}];
  }
};

exports.getOne = async (id, isDeleted = 0) => {
  return await db
    .select(
      "id",
      "instance_url",
      "username",
      "token",
      "watch_node",
      "watch_folder",
      "sync_path",
      "sync_enabled",
      "sync_frequency",
      "sync_in_progress",
    )
    .first()
    .from("accounts")
    .where("id", id)
    .where('is_deleted', isDeleted);
};

exports.getPassword = async id => {
  return await db
    .select("*")
    .first()
    .from("accounts")
    .where("id", id);
};

exports.getOneByAccountId = async (id, isDeleted = 0) => {
  return await db
    .select("*")
    .first()
    .from("accounts")
    .where("id", id)
    .where('is_deleted', isDeleted);
};

exports.findByInstance = async (instance_url, username, isDeleted = 0) => {
  return await db
    .select("*")
    .first()
    .from("accounts")
    .where("instance_url", instance_url)
    .where("username", username)
    .where('is_deleted', isDeleted);
};

exports.syncPathExists = async (sync_path, accountId = null, isDeleted = 0) => {
  let query = await db
    .select(['sync_path'])
    .modify(queryBuilder => {
      if (accountId) {
        queryBuilder.whereNot("id", accountId);
      }
    })
    .from("accounts")
    .where("sync_path", sync_path)
    .where('is_deleted', isDeleted);

  return query;
}

exports.findByInstanceSiteName = async (instance_url, siteName, isDeleted = 0) => {
  console.log('instance_url', instance_url);
  console.log('siteName', siteName);
  return await db
    .select("*")
    .from("accounts")
    .where("instance_url", instance_url)
    .where("site_name", siteName)
    .where("sync_enabled", 1)
    .where('is_deleted', isDeleted);
};

exports.getNodes

exports.findByInstanceAccounts = async (instance_url, accounts, isDeleted = 0) => {
  return await db
    .select("*")
    .from("accounts")
    .whereIn("id", accounts)
    .where("instance_url", instance_url)
    .where("sync_enabled", 1)
    .where('is_deleted', isDeleted);
};

exports.addAccount = async request => {
  return await db
    .insert({
      instance_url: request.body.instance_url.replace(/\/+$/, ""),
      username: request.body.username,
      password: crypt.encrypt(request.body.password),
      watch_node: request.body.watch_node,
      sync_path: request.body.sync_path,
      sync_enabled: request.body.sync_enabled,
      sync_frequency: request.body.sync_frequency,
      created_at: new Date().getTime(),
      updated_at: new Date().getTime(),
      is_deleted: 0
    })
    .into("accounts");
};

exports.updateAccount = async (accountId, request) => {
  return await db("accounts")
    .update({
      instance_url: request.body.instance_url.replace(/\/+$/, ""),
      username: request.body.username,
      password: crypt.encrypt(request.body.password),
      sync_path: request.body.sync_path,
      sync_enabled: request.body.sync_enabled,
      sync_frequency: request.body.sync_frequency,
      updated_at: new Date().getTime()
    })
    .where("id", accountId);
};

exports.updateWatchNode = async (accountId, request) => {
  return await db("accounts")
    .update({
      site_name: request.body.site_name,
      watch_folder: request.body.watch_folder,
      watch_node: request.body.watch_node,
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
      token_updated_at: new Date().getTime(),
      updated_at: new Date().getTime()
    })
    .where("id", accountId);
};

exports.deleteAccount = async accountId => {
  return await db("accounts")
    .update({
      is_deleted: 1,
    })
    .where("id", accountId);
};

exports.forceDelete = async accountId => {
  return await db("accounts")
    .delete()
    .where("id", accountId);
};
