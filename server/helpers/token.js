const crypt = require("../config/crypt");
const btoa = require("btoa");
const request = require("request-promise-native");
const accountModel = require("../models/account");
const errorLogModel = require("../models/log-error");

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

  account = await accountModel.getPassword(account.id);

  let now = Date.now();
  let updatedAt = account.updated_at;
  let differenceMinutes = (now - updatedAt) / 1000 / 60;

  // If the token was generated less than 60 minutes then we can return the token instead of generating a new one
  if (differenceMinutes < 60 && account.token) {
    return account.token;
  }

  var options = {
    method: "POST",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/authentication/versions/1/tickets",
    body: JSON.stringify({
      userId: account.username,
      password: crypt.decrypt(account.password)
    })
  };

  try {
    let response = await request(options);
    response = JSON.parse(response);
    let token = btoa(response.entry.id);
    // Update token in DB
    accountModel.updateToken(account.id, token);
    return token;
  } catch (error) {
    errorLogModel.add(account.id, error);
  }
};
