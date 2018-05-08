const { db } = require("../config/db");
const crypt = require("../config/crypt");

exports.getAll = async () => {
  return await db.select("instance_url").from("accounts");
};

exports.getOne = async id => {
  return await db
    .select("*")
    .first()
    .from("accounts")
    .where("id", id);
};

exports.addInstance = async request => {
  return await db
    .insert({
      instance_url: request.body.instance_url,
      username: request.body.username,
      password: crypt.encrypt(request.body.password)
    })
    .into("accounts");
};
