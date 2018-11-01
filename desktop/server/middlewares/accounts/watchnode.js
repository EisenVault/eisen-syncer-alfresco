const validator = require("validator");
const _ = require("lodash");
const http = require("request-promise-native");

module.exports = async (request, response, next) => {
  let errors = [];

  if (
    _.isNil(request.body.site_name) ||
    validator.isEmpty(String(request.body.site_name))
  ) {
    errors.push({
      site_name: ["Site name cannot be empty"]
    });
  }

  if (
    _.isNil(request.body.watch_node) ||
    validator.isEmpty(String(request.body.watch_node))
  ) {
    errors.push({
      watch_node: ["Watch Node cannot be empty"]
    });
  }

  if (
    _.isNil(request.body.watch_folder) ||
    validator.isEmpty(String(request.body.watch_folder))
  ) {
    errors.push({
      watch_folder: ["Watch Folder cannot be empty"]
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
