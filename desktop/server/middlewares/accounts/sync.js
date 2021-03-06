const validator = require("validator");
const _ = require("lodash");
const { watcherModel } = require('../../models/watcher');

module.exports = async (request, response, next) => {
  let errors = [];

  if (
    _.isNil(request.body.sync_enabled) ||
    validator.isEmpty(String(request.body.sync_enabled))
  ) {
    errors.push({
      sync_enabled: ["Auto Sync cannot be empty"]
    });
  }

  const removeFolders = await watcherModel.findAll({
    where: {
      account_id: request.params.id
    }
  });
  if (removeFolders && removeFolders.length === 0 && request.body.sync_enabled === true) {
    errors.push({
      sync_enabled: ["Sync cannot be enabled for this account since no remote folder was selected."]
    });
  }

  // Check if the error array has any data in it
  if (errors && errors.length > 0) {
    return response.status(400).json({
      errors: errors
    });
  }

  next();
};
