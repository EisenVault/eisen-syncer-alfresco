const fs = require("fs");
const path = require("path");
const btoa = require("btoa");
const request = require("request-promise-native");
const accountModel = require("../models/account");

/**
 *
 * @param object params
 * {
 *  accountId: '',
 *  parentNodeId: ''
 * }
 */
exports.getChildren = async params => {
  let accountId = params.accountId;
  let parentNodeId = params.parentNodeId;
  let account = await accountModel.getOne(accountId);

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
      authorization: "Basic " + btoa(account.username + ":" + account.password)
    }
  };

  try {
    let response = await request(options);
    return response;
  } catch (error) {
    throw new Error(error);
  }
};
