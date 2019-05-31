const Sequelize = require("sequelize");
const validator = require("validator");
const _ = require("lodash");
const http = require("request-promise-native");
const { accountModel } = require("../../models/account");
const _path = require("../../helpers/path");

module.exports = async (request, response, next) => {
  let errors = [];

  if (
    _.isNil(request.body.instance_url) ||
    !validator.isURL(request.body.instance_url)
  ) {
    errors.push({
      instance_url: ["Instance URL is invalid"]
    });
  }

  if (
    _.isNil(request.body.username) ||
    validator.isEmpty(request.body.username)
  ) {
    errors.push({
      username: ["Username cannot be empty"]
    });
  }

  if (
    _.isNil(request.body.password) ||
    validator.isEmpty(request.body.password)
  ) {
    errors.push({
      password: ["Password cannot be empty"]
    });
  }

  if (
    _.isNil(request.body.sync_path) ||
    validator.isEmpty(request.body.sync_path)
  ) {
    errors.push({
      sync_path: ["Sync Path cannot be empty"]
    });
  }

  // Sync path should be unique per account. That means no two same sync path can be added to two different accounts
  let whereStatement = {
    sync_path: _path.toUnix(request.body.sync_path)
  };
  // If account id is specified, include it in the where clause
  if (request.body.account_id) {
    whereStatement.id = {
      [Sequelize.Op.ne]: request.body.account_id
    };
  }

  const syncPathAlreadyExists = await accountModel.findOne({
    where: whereStatement
  });
  if (syncPathAlreadyExists) {
    errors.push({
      sync_path: [
        "Sync Path is already reserved with another account. Choose different sync path."
      ]
    });
  }

  if (
    _.isNil(request.body.sync_frequency) ||
    validator.isEmpty(String(request.body.sync_frequency))
  ) {
    errors.push({
      sync_frequency: ["Sync Frequency cannot be empty"]
    });
  }

  if (
    _.isEmpty(errors) &&
    !validator.isEmpty(request.body.instance_url) &&
    !validator.isEmpty(request.body.username) &&
    !validator.isEmpty(request.body.password)
  ) {
    var options = {
      method: "POST",
      agent: false,
      timeout: 20000,
      resolveWithFullResponse: true,
      url:
        request.body.instance_url +
        "/alfresco/api/-default-/public/authentication/versions/1/tickets",
      json: true,
      body: {
        userId: request.body.username,
        password: request.body.password
      }
    };

    try {
      let response = await http(options);

      if (!response.body.entry.id) {
        errors.push({
          username: ["Authentication to the server failed"]
        });
      }
    } catch (error) {
      errors.push({
        username: ["Authentication to the server failed"]
      });
    }
  }

  // Check if the error array has any data in it
  if (errors && errors.length > 0) {
    return response.status(400).json({
      errors: errors
    });
  }

  next();
};
