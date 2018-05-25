const express = require("express");
const accountModel = require("../models/account");
const validator = require("validator");

exports.getAll = async (request, response) => {
  return response.status(200).json(await accountModel.getAll());
};

exports.getOne = async (request, response) => {
  return response
    .status(200)
    .json(await accountModel.getOne(request.params.id));
};

exports.addAccount = async (request, response) => {
  // Before adding the new account lets check if the account already exsits
  // let account = await accountModel.findByInstance(
  //   request.body.instance_url,
  //   request.body.username
  // );

  // if (account) {
  //   // If the account already exists, delete it so that we can add the fresh data
  //   accountModel.deleteAccount(account.id);
  // }

  // If its a new account add it to the DB
  let accountId = await accountModel.addAccount(request);

  return response.status(201).json({
    account_id: accountId[0]
  });
};

exports.updateAccount = async (request, response) => {
  let accountId = await accountModel.updateAccount(request.params.id, request);
  return response.status(200).json({
    account_id: request.params.id
  });
};

exports.updateSync = async (request, response) => {
  let account = await accountModel.updateSync(request.params.id, request);

  return response.status(200).json({
    success: true
  });
};

exports.updateSyncTime = async (request, response) => {
  let account = await accountModel.updateSyncTime(request.params.id);

  return response.status(200).json({
    success: true
  });
};

exports.deleteAccount = async (request, response) => {
  return response
    .status(200)
    .json(await accountModel.deleteAccount(request.params.id));
};
