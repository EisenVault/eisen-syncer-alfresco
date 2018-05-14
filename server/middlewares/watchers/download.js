const validator = require("validator");
const _ = require("lodash");

module.exports = (request, response, next) => {
  let errors = [];
  if (
    _.isNil(request.query.account_id) ||
    _.isEmpty(request.query.account_id)
  ) {
    errors.push({account_id: "Account ID is mandatory"});
  }

  if (errors.length > 0) {
    return response.status(400).json({ errors: errors });
  }


  next();
};
