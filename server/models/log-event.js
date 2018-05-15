const { db } = require("../config/db");
const MIN_THRESHOLD = 200;

exports.getAll = async () => {
  return await db.select("*").from("log_events");
};

exports.getOne = async id => {
  return await db
    .select("*")
    .first()
    .from("log_events")
    .where("id", id);
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
