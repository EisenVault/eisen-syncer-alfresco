const { errorLogModel } = require("../../models/log-error");
const { accountModel } = require("../../models/account");

exports.getAll = async (request, response) => {
  const errors = await errorLogModel.findAll({
    include: [{
      model: accountModel,
      attributes: { exclude: ['password'] }
    }],
    order: [
      ['id', 'DESC']
    ],
    limit: 1000
  });
  return response.status(200).json(errors);
};

exports.getAllByAccountId = async (request, response) => {
  return response.status(200).json(await errorLogModel.findAll({
    where: {
      account_id: request.params.account_id
    }
  }));
};