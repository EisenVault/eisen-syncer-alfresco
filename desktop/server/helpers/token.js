const crypt = require("../config/crypt");
const btoa = require("btoa");

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

  return btoa(`${account.username}:${crypt.decrypt(account.password)}`);
};
