const validator = require("validator");
const _ = require("lodash");

module.exports = async (request, response, next) => {
  let errors = [];

  if (_.isNil(request.body.nodes)) {
    errors.push({
      nodes: ["Nodes field is mandatory"]
    });
  }

  if (typeof request.body.nodes !== "object" || request.body.nodes.length < 1) {
    errors.push({
      nodes: ["Nodes field must be an array and not empty"]
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
