const validator = require("validator");
const _ = require("lodash");
const accountModel = require("../../models/account");

module.exports = async (request, response, next) => {
  let errors = [];
  if (
    _.isNil(request.params.accountId) ||
    _.isEmpty(request.params.accountId)
  ) {
    errors.push({ accountId: "Account ID is mandatory" });
  }

  let account = await accountModel.getOne(request.params.accountId);
  if (account === undefined) {
    errors.push({ accountId: "Account ID is invalid" });
  }

  if (errors.length > 0) {
    return response.status(400).json({ errors: errors });
  }

  next();
};