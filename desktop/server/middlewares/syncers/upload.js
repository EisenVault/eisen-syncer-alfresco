const _ = require("lodash");
const { accountModel } = require("../../models/account");

module.exports = async (request, response, next) => {
  let errors = [];

  if (_.isNil(request.body.account_id)) {
    errors.push({ account_id: "Account ID is mandatory" });
  }

  let account = await accountModel.findByPk(request.body.account_id);
  if (account === undefined) {
    errors.push({ accountId: "Account ID is invalid" });
  }

  if (errors && errors.length > 0) {
    return response.status(400).json({ errors: errors });
  }

  next();
};
