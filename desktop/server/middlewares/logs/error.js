const validator = require("validator");
const _ = require("lodash");

module.exports = async (request, response, next) => {
  let errors = [];

  if (
    _.isNil(request.body.account_id) ||
    validator.isEmpty(request.body.account_id)
  ) {
    errors.push({
      account_id: ["Account ID field is mandatory"]
    });
  }

  if (
    _.isNil(request.body.description) ||
    validator.isEmpty(request.body.description)
  ) {
    errors.push({
      description: ["Description field is mandatory"]
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
