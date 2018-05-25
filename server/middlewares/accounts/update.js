const validator = require("validator");
const _ = require("lodash");
const http = require("request-promise-native");

module.exports = async (request, response, next) => {
  let errors = [];

  if (
    _.isNil(request.body.sync_on) ||
    validator.isEmpty(String(request.body.sync_on))
  ) {
    errors.push({
      sync_on: ["Auto Sync cannot be empty"]
    });
  }

  // Check if the error array has any data in it
  if (errors.length > 0) {
    return response.status(400).json({
      errors: errors
    });
  }

  next();
};
