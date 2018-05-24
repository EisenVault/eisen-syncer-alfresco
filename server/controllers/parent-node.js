const express = require("express");
const accountModel = require("../models/account");
const crypt = require("../config/crypt");
const btoa = require("btoa");
const http = require("request-promise-native");
const errorLogModel = require("../models/log-error");

exports.getAll = async (request, response) => {
  let nodeId = request.params.node_id;
  let account = await accountModel.getOneByAccountId(request.params.account_id);


  if (!account) {
    return response.status(401).json({ error: "Account not found" });
  }

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      nodeId +
      "/parents",
    headers: {
      authorization:
        "Basic " +
        btoa(account.username + ":" + crypt.decrypt(account.password))
    }
  };

  try {
    let data = await http(options);
    return response.status(200).json(JSON.parse(data));
  } catch (error) {
    errorLogModel.add(account.id, error);
  }
};
