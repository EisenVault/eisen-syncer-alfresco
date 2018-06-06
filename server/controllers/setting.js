const express = require("express");
const settingModel = require("../models/setting");
const AutoLaunch = require("auto-launch");
const appName = require( (__dirname + "/package.json").replace('/server/controllers', '')).name;

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
  const autoLauncher = new AutoLaunch({
    name: appName
  });

  if (request.body.value === 1) {
    // Enable autolaunch
    autoLauncher.enable();
    console.log("Autolaunch enabled");
  } else {
    // Disable autolaunch
    autoLauncher.disable();
    console.log("Autolaunch disabled");
  }

  let setting = await settingModel.update("LAUNCH_AT_STARTUP", request);
  return response.status(200).json({
    setting: setting
  });
};
