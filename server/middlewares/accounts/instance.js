const validator = require("validator");
const _ = require("lodash");

module.exports = (request, response, next) => {
  if (
    _.isNil(request.body.instance_url) ||
    !validator.isURL(request.body.instance_url)
  ) {
    return response.status(400).json({
      error: "Instance URL is invalid"
    });
  }

  if (
    _.isNil(request.body.username) ||
    validator.isEmpty(request.body.username)
  ) {
    return response.status(400).json({
      error: "Username cannot be empty"
    });
  }

  if (
    _.isNil(request.body.password) ||
    validator.isEmpty(request.body.password)
  ) {
    return response.status(400).json({
      error: "Password cannot be empty"
    });
  }

  next();
};
