const crypt = require("../config/crypt");
const btoa = require("btoa");
const accountModel = require("../models/account");

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 * }
 */
exports.get = async account => {
  if (!account) {
    throw new Error("Account not found");
  }

  account = await accountModel.getOneWithPassword(account.id);

  return btoa(`${account.username}:${crypt.decrypt(account.password)}`);
};
