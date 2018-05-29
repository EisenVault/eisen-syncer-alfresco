const express = require("express");
const accountModel = require("../models/account");
const crypt = require("../config/crypt");
const btoa = require("btoa");
const http = require("request-promise-native");
const errorLogModel = require("../models/log-error");
const token = require("../helpers/token");

exports.getAll = async (request, response) => {
  let account = await accountModel.getOneByAccountId(request.params.account_id);

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/sites?maxItems=9999",
    headers: {
      authorization:
        "Basic " + await token.get(account)
    }
  };

  try {
    let data = await http(options);
    return response.status(200).json(JSON.parse(data));
  } catch (error) {
    errorLogModel.add(account.id, error);
  }
};
