const watcherModel = require("../models/watcher");


exports.getAll = async (request, response) => {
  const accountId = request.params.accountId;
  return response.status(200).json(await watcherModel.getAllByAccountId(accountId));
};
