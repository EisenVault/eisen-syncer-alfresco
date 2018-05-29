const fs = require("fs");
const path = require("path");
const crypt = require("../config/crypt");
const btoa = require("btoa");
const request = require("request-promise-native");
const accountModel = require("../models/account");
const errorLogModel = require("../models/log-error");
const token = require("../helpers/token");

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  parentNodeId: ''
 * }
 */
exports.getChildren = async params => {
  let account = params.account;
  let parentNodeId = params.parentNodeId;

  if (!account) {
    throw new Error("Account not found");
  }

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      parentNodeId +
      "/children",
    headers: {
      authorization: "Basic " + await token.get(account)
    }
  };

  try {
    let response = await request(options);
    return JSON.parse(response);
  } catch (error) {
    errorLogModel.add(account.id, error);
    console.log(error);
  }
};
