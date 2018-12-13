const { accountModel } = require("../models/account");
const http = require("request-promise-native");
const { add: errorLogAdd } = require("../models/log-error");
const token = require("../helpers/token");

exports.getAll = async (request, response) => {
  let nodeId = request.params.node_id;
  let account = await accountModel.findByPk(request.params.account_id);

  if (!account) {
    return response.status(401).json({ error: "Account not found" });
  }

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      nodeId +
      "/parents?include=path",
    headers: {
      authorization:
        "Basic " + await token.get(account)
    }
  };

  try {
    let data = await http(options);
    return response.status(200).json(JSON.parse(data));
  } catch (error) {
    errorLogAdd(account.id, error);
  }
};
