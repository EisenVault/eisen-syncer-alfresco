const { eventLogModel } = require("../../models/log-event");
const { accountModel } = require("../../models/account");

exports.getAll = async (request, response) => {
  return response.status(200).json(await eventLogModel.findAll({
    include: [{
      model: accountModel,
      attributes: { exclude: ['password'] }
    }],
    order: [
      ['id', 'DESC']
    ],
    limit: 1000
  }));
};

exports.getAllByAccountId = async (request, response) => {
  return response.status(200).json(await eventLogModel.findAll({
    where: {
      account_id: request.params.account_id
    }
  }));
};