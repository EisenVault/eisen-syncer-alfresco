const accountModel = require("../models/account");
const http = require("request-promise-native");
const errorLogModel = require("../models/log-error");
const token = require("../helpers/token");

exports.getAll = async (request, response) => {
  let nodeId = request.params.node_id;
  let account = await accountModel.getOneByAccountId(request.params.account_id);  
  var options = {
    method: "GET",
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
    errorLogModel.add(account.id, error);
  }
};
