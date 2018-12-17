const Sequelize = require("sequelize");
const validator = require("validator");
const _ = require("lodash");
const { accountModel } = require("../../models/account");

module.exports = async (request, response, next) => {
  let errors = [];

  if (
    _.isNil(request.body.sync_path) ||
    validator.isEmpty(request.body.sync_path)
  ) {
    errors.push({
      sync_path: ["Sync Path cannot be empty"]
    });
  }


  // Sync path should be unique per account. That means no two same sync path can be added to two different accounts
  let whereStatement = {
    sync_path: request.body.sync_path
  };
  // If account id is specified, include it in the where clause
  if (request.params.id) {
    whereStatement.id = {
      [Sequelize.Op.ne]: request.params.id
    }
  }
  const syncPathAlreadyExists = await accountModel.findOne({
    where: whereStatement
  })
  if (syncPathAlreadyExists) {
    errors.push({
      sync_path: ["Sync Path is already reserved with another account. Choose different sync path."]
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
