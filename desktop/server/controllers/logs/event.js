const express = require("express");
const eventLogModel = require("../../models/log-event");

exports.getAll = async (request, response) => {
  return response.status(200).json(await eventLogModel.getAll(request));
};

exports.getAllByAccountId = async (request, response) => {
  return response.status(200).json(await eventLogModel.getAllByAccountId(request.params.account_id));
};

exports.getOne = async (request, response) => {
  return response
    .status(200)
    .json(await eventLogModel.getOne(request.params.id));
};

exports.add = async (request, response) => {
  let eventId = await eventLogModel.add(request.body.account_id, request.body.type, request.body.description);

  return response.status(201).json({
    id: eventId[0]
  });
};
