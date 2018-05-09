const validator = require("validator");
const _ = require("lodash");

module.exports = (request, response, next) => {
  if (
    _.isNil(request.query.account_id) ||
    _.isEmpty(request.query.account_id)
  ) {
    return response.status(400).json({
      error: "account_id is mandatory"
    });
  }

  if (
    _.isNil(request.query.parent_node_id) ||
    _.isEmpty(request.query.parent_node_id)
  ) {
    return response.status(400).json({
      error: "parent_node_id is mandatory"
    });
  }

  next();
};
