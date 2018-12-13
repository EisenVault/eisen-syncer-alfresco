const { watcherModel } = require("../models/watcher");
const { accountModel } = require("../models/account");

exports.getAll = async (request, response) => {
  const accountId = request.params.accountId;

  const watchers = await watcherModel.findAll({
    where: {
      account_id: accountId
    },
    include: [{
      model: accountModel,
      attributes: { exclude: ['password'] }
    }],
  })

  return response.status(200).json(watchers);
};
