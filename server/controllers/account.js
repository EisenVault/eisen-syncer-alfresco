const express = require("express");
const accountModel = require("../models/account");
const validator = require("validator");

exports.getAll = async (request, response) => {
  return response.status(200).json(await accountModel.getAll());
};

exports.getOne = async (request, response) => {
  console.log(request.params.id);

  return response
    .status(200)
    .json(await accountModel.getOne(request.params.id));
};

exports.addInstance = async (request, response) => {
  let accountId = await accountModel.addInstance(request);

  return response.status(200).json({
    account_id: accountId[0]
  });
};

exports.updateInstance = async (request, response) => {
  return response.status(200).json(await accountModel.getAll());
};

exports.deleteInstance = async (request, response) => {
  return response.status(200).json(await accountModel.getAll());
};
