const { accountModel } = require("../models/account");
const http = require("request-promise-native");
const { add: errorLogAdd } = require("../models/log-error");
const token = require("../helpers/token");

exports.getAll = async (request, response) => {
  let nodeId = request.params.node_id;
  let { dataValues: account } = await accountModel.findByPk(request.params.account_id);

  var options = {
    method: "GET",
    agent: false,
    timeout: 20000,
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      nodeId +
      "/children?include=path&maxItems=9999&where=(isFolder=true)",
    headers: {
      authorization:
        "Basic " + await token.get(account)
    }
  };

  try {
    let data = await http(options);
    return response.status(200).json(JSON.parse(data));
  } catch (error) {
    errorLogAdd(account.id, error, `${__filename}/getAll`);
  }
};
