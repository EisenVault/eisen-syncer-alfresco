const { db } = require("../config/db");
const MIN_THRESHOLD = 200;

exports.getAll = async () => {
  return await db
    .select(
      "log_events.*",
      "accounts.instance_url",
      "accounts.username",
      "accounts.sync_path",
      "accounts.sync_enabled",
      "accounts.overwrite"
    )
    .from("log_events")
    .innerJoin("accounts", "log_events.account_id", "accounts.id")
    .orderBy("log_events.id", "DESC");
};

exports.getAllByAccountId = async accountId => {
  return await db
    .select(
      "log_events.*",
      "accounts.instance_url",
      "accounts.username",
      "accounts.sync_path",
      "accounts.sync_enabled",
      "accounts.overwrite"
    )
    .from("log_events")
    .innerJoin("accounts", "log_events.account_id", "accounts.id")
    .where("log_events.account_id", accountId)
    .orderBy("log_events.id", "DESC");
};

exports.getOne = async id => {
  return await db
    .select(
      "log_events.*",
      "accounts.instance_url",
      "accounts.username",
      "accounts.sync_path",
      "accounts.sync_enabled",
      "accounts.overwrite"
    )
    .first()
    .from("log_events")
    .innerJoin("accounts", "log_events.account_id", "accounts.id")
    .where("log_events.id", id);
};

exports.getCount = async () => {
  return await db("log_events")
    .count("id as total")
    .first();
};

exports.add = async (accountId, type, description) => {
  let eventId = await db
    .insert({
      account_id: accountId,
      type: type,
      description: description,
      created_at: new Date().getTime()
    })
    .into("log_events");

  // Delete old records
  let count = await this.getCount();
  if (count.total > MIN_THRESHOLD) {
    let removableId = eventId[0] - MIN_THRESHOLD;
    this.deleteAllLessThan(removableId);
  }

  return eventId;
};

exports.deleteAllLessThan = async id => {
  await db("log_events")
    .where("id", "<", id)
    .delete();
};
