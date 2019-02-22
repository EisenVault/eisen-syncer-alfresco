const { settingModel } = require("../models/setting");
var package = require('../../package.json');

exports.getAll = async (request, response) => {
  return response.status(200).json(await settingModel.findAll());
};

exports.getOne = async (request, response) => {
  return response
    .status(200)
    .json(await settingModel.findOne({
      where: {
        name: request.params.name
      }
    }));
};

exports.about = async (request, response) => {
  return response
    .status(200)
    .json({
      "name": package.name,
      "version": package.version
    });
};

exports.add = async (request, response) => {
  try {
    let setting = await settingModel.create({
      name: request.body.name,
      value: request.body.value
    });

    return response.status(201).json({
      setting: setting
    });
  } catch (error) {

  }
};

exports.update = async (request, response) => {
  try {
    let setting = await settingModel.update({
      value: request.body.value
    }, {
        where: {
          name: request.params.name
        }
      });

    return response.status(200).json({
      setting: setting
    });
  } catch (error) {

  }
};