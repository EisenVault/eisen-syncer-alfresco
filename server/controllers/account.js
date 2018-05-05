const express = require("express");
const accountModel = require("../models/account");

exports.getAll = async (request, response) => {
  return response.status(200).json(await accountModel.getAll());
};
