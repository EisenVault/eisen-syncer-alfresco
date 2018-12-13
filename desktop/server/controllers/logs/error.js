const { errorLogModel } = require("../../models/log-error");

exports.getAll = async (request, response) => {
  return response.status(200).json(await errorLogModel.findAll());
};

exports.getAllByAccountId = async (request, response) => {
  return response.status(200).json(await errorLogModel.findAll({
    where: {
      account_id: request.params.account_id
    }
  }));
};