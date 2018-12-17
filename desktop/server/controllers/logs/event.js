const { eventLogModel } = require("../../models/log-event");

exports.getAll = async (request, response) => {
  return response.status(200).json(await eventLogModel.findAll());
};

exports.getAllByAccountId = async (request, response) => {
  return response.status(200).json(await eventLogModel.findAll({
    where: {
      account_id: request.params.account_id
    }
  }));
};