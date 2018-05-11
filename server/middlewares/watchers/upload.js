const validator = require("validator");
const _ = require("lodash");

module.exports = (request, response, next) => {
  if (_.isNil(request.body.account_id) || _.isEmpty(request.body.account_id)) {
    return response.status(400).json({
      error: "account_id is mandatory"
    });
  }

  if (_.isNil(request.body.overwrite) || _.isEmpty(request.body.overwrite)) {
    return response.status(400).json({
      error: "overwrite is mandatory"
    });
  }

  next();
};
