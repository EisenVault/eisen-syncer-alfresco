const express = require("express");
const settingModel = require("../models/setting");

exports.getAll = async (request, response) => {
  return response.status(200).json(await settingModel.getAll());
};

exports.getOne = async (request, response) => {
  return response
    .status(200)
    .json(await settingModel.getOne(request.params.name));
};

exports.add = async (request, response) => {
  let setting = await settingModel.add(request);

  return response.status(201).json({
    setting: setting
  });
};

exports.update = async (request, response) => {
  let setting = await settingModel.update(request.params.name, request);
  return response.status(200).json({
    setting: setting
  });
};

exports.startupLaunch = async (request, response) => {
  await settingModel.update("LAUNCH_AT_STARTUP", request);
  let setting = await settingModel.getOne('LAUNCH_AT_STARTUP');
  return response.status(200).json({
    setting: setting
  });
};
