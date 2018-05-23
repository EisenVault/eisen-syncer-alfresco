const express = require("express");
const watchNodeModel = require("../models/watch-node");

exports.getAll = async (request, response) => {
  return response
    .status(200)
    .json(await watchNodeModel.getNodes(request.params.account_id));
};

exports.add = async (request, response) => {
  // Delete old records first
  watchNodeModel.delete(request.body.account_id);

  // Add new nodes
  for (let node of request.body.nodes) {
    let record = await watchNodeModel.add(request.body.account_id, node);
  }

  return response.status(201).json({
    success: true
  });
};

exports.update = async (request, response) => {
  // Delete the old records first
  await watchNodeModel.delete(request.params.account_id);

  // Add new nodes
  for (let node of request.body.nodes) {
    let record = await watchNodeModel.add(request.params.account_id, node);
  }

  return response.status(200).json({
    success: true
  });
};
