const fs = require("fs");
const path = require("path");
const btoa = require("btoa");
const request = require("request-promise-native");
const accountModel = require("../models/account");

/**
 *
 * @param object params
 * {
 *  accountId: '',
 *  sourcePath: '',
 *  destinationNodeId: '',
 *  uploadDirectory: '',
 *  overwrite: true/false
 * }
 */
exports.upload = async params => {
  let accountId = params.accountId;
  let sourcePath = params.sourcePath;
  let filename = path.basename(params.sourcePath);
  let destinationNodeId = params.destinationNodeId;
  let uploadDirectory = params.uploadDirectory;
  let overwrite = params.overwrite;

  let account = await accountModel.getOne(accountId);

  if (!account) {
    throw new Error("Account not found");
  }

  var options = {
    resolveWithFullResponse: true,
    method: "POST",
    url: account.instance_url + "/alfresco/service/api/upload",
    headers: {
      authorization: "Basic " + btoa(account.username + ":" + account.password)
    },
    formData: {
      filedata: {
        value: fs.createReadStream(sourcePath),
        options: {}
      },
      filename: filename,
      destination: "workspace://SpacesStore/" + destinationNodeId,
      uploadDirectory: uploadDirectory,
      overwrite: overwrite
    }
  };

  try {
    let response = await request(options);
    return response.body;
  } catch (error) {
    throw new Error(error);
  }
};

/**
 *
 * @param object params
 * {
 *  accountId: '',
 *  destinationPath: '',
 *  sourceNodeId: '',
 * }
 */
exports.download = async params => {
  let accountId = params.accountId;
  let sourceNodeId = params.sourceNodeId;
  let destinationPath = params.destinationPath;

  let account = await accountModel.getOne(accountId);

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      sourceNodeId +
      "/content?attachment=true",
    headers: {
      authorization: "Basic " + btoa(account.username + ":" + account.password)
    }
  };

  try {
    let response = await request(options).pipe(
      fs.createWriteStream(destinationPath)
    );
    return params;
  } catch (error) {
    throw new Error(error);
  }
};
