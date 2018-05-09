const validator = require("validator");
const _ = require("lodash");

module.exports = (request, response, next) => {
  if (_.isNil(request.body.path)) {
    return response.status(400).json({
      error: "Path is invalid"
    });
  }

  next();
};
