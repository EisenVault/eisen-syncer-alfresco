var bugsnag = require("bugsnag");
const log = require("electron-log");
const { logger } = require("../helpers/logger");
const { db } = require("../config/db");
const MIN_THRESHOLD = 200;

exports.getAll = async () => {
  return await db
    .select(
      "log_errors.id",
      "log_errors.account_id",
      "log_errors.description",
      "log_errors.created_at",
      "accounts.instance_url",
      "accounts.username",
      "accounts.sync_path",
      "accounts.sync_enabled"
    )
    .from("log_errors")
    .innerJoin("accounts", "log_errors.account_id", "accounts.id")
    .orderBy("log_errors.id", "DESC");
};

exports.getAllByAccountId = async accountId => {
  return await db
    .select(
      "log_errors.id",
      "log_errors.account_id",
      "log_errors.description",
      "log_errors.created_at",
      "accounts.instance_url",
      "accounts.username",
      "accounts.sync_path",
      "accounts.sync_enabled"
    )
    .from("log_errors")
    .innerJoin("accounts", "log_errors.account_id", "accounts.id")
    .where("log_errors.account_id", accountId)
    .orderBy("log_errors.id", "DESC");
};

exports.getOne = async id => {
  return await db
    .select(
      "log_errors.id",
      "log_errors.account_id",
      "log_errors.description",
      "log_errors.created_at",
      "accounts.instance_url",
      "accounts.username",
      "accounts.sync_path",
      "accounts.sync_enabled"
    )
    .first()
    .from("log_errors")
    .innerJoin("accounts", "log_errors.account_id", "accounts.id")
    .where("id", id);
};

exports.getCount = async () => {
  return await db("log_errors")
    .count("id as total")
    .first();
};

exports.add = async (accountId, description) => {
  try {
    let eventId = await db
      .insert({
        account_id: accountId,
        description: String(description),
        created_at: new Date().getTime()
      })
      .into("log_errors");

    // Delete old records
    let count = await this.getCount();
    if (count.total > MIN_THRESHOLD) {
      let removableId = eventId[0] - MIN_THRESHOLD;
      exports.deleteAllLessThan(removableId);
    }

    if (description && description.toString().indexOf("StatusCodeError: 404") === -1) {
      log.warn(description);
      logger.error(`##-----------ERROR OCCURRED: ${description}-----------##`);
      bugsnag.notify(description.toString());
    }
    logger.error(`##-----------ERROR OCCURRED: ${description}-----------##`);


    return eventId;
  } catch (error) {
    log.warn(String(error));
    logger.error(String(error));
  }
};

exports.deleteAllLessThan = async id => {
  await db("log_errors")
    .where("id", "<", id)
    .delete();
};
