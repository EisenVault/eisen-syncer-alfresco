const fs = require("fs");
const _ = require("lodash");
const ondemand = require("../helpers/syncers/ondemand");
const remote = require("../helpers/remote");
const accountModel = require("../models/account");

// Upload a file to an instance
exports.upload = async (request, response) => {
  console.log( 'UPLOAD START' );

  let account = await accountModel.getOne(request.body.account_id);

  try {
    await ondemand.recursiveUpload({
      account: account,
      rootNodeId: account.watch_node
    });

    console.log( 'UPLOAD END' );


    return response
      .status(200)
      .json(await accountModel.getOne(request.body.account_id));
  } catch (error) {
    return response
      .status(404)
      .json({ success: false, error: "Nothing to upload", error: error });
  }
};

// Download nodes and its children from a remote instance
exports.download = async (request, response) => {
  console.log( 'DOWNLOAD START' );

  let account = await accountModel.getOne(request.params.accountId);

  try {
    await ondemand.recursiveDownload({
      account: account,
      sourceNodeId: account.watch_node,
      destinationPath: account.sync_path
    });

    console.log( 'DOWNLOAD END' );


    return response.status(200).json({ success: true });
  } catch (error) {
    return response
      .status(404)
      .json({ success: false, error: "Nothing to download" });
  }
};

// Delete records from DB for files that do not exists on local
exports.delete = async (request, response) => {
  let account = await accountModel.getOne(request.params.accountId);

  try {
    console.log( 'DELETE START' );
    
    await ondemand.recursiveDelete({
      account: account
    });

    console.log( 'DELETE END' );


    return response
      .status(200)
      .json(account);
  } catch (error) {
    console.log("error", error);

    return response
      .status(404)
      .json({ success: false, error: error, error: error });
  }
};
