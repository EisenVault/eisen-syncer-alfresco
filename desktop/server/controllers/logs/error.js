const express = require("express");
const errorLogModel = require("../../models/log-error");

exports.getAll = async (request, response) => {
  return response.status(200).json(await errorLogModel.getAll());
};

exports.getAllByAccountId = async (request, response) => {
  return response.status(200).json(await errorLogModel.getAllByAccountId(request.params.account_id));
};

exports.getOne = async (request, response) => {
  return response
    .status(200)
    .json(await errorLogModel.getOne(request.params.id));
};

exports.add = async (request, response) => {
  let eventId = await errorLogModel.add(request.body.account_id, request.body.description);

  return response.status(201).json({
    id: eventId[0]
  });
};
