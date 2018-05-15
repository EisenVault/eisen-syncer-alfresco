const validator = require("validator");
const _ = require("lodash");

module.exports = (request, response, next) => {
  let errors = [];
  if (_.isNil(request.body.path)) {
    errors.push({
      path: "Path is invalid"
    });
  }

  if (errors.length > 0) {
    return response.status(400).json({ errors: errors });
  }

  next();
};
