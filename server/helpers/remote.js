const fs = require("fs");
const path = require("path");
const request = require("request-promise-native");
const io = require("socket.io-client");
const machineID = require("node-machine-id");
const errorLogModel = require("../models/log-error");
const eventLogModel = require("../models/log-event");
const nodeModel = require("../models/node");
const token = require("./token");
const _base = require("./syncers/_base");

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  nodeId: string
 * }
 */
exports.getNodeCount = async params => {
  let account = params.account;
  let nodeId = params.nodeId;

  if (!account) {
    throw new Error("Account not found");
  }

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/s/com/eisenvault/totalNodesCount/" +
      nodeId,
    headers: {
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    let response = await request(options);
    return JSON.parse(response);
  } catch (error) {
    await errorLogModel.add(account.id, error);
  }
};

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  parentNodeId: ''
 * }
 */
exports.getChildren = async params => {
  let account = params.account;
  let parentNodeId = params.parentNodeId;

  if (!account) {
    throw new Error("Account not found");
  }

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      parentNodeId +
      "/children",
    headers: {
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    let response = await request(options);
    return JSON.parse(response);
  } catch (error) {
    await errorLogModel.add(account.id, error);
  }
};

/**
 * @param object params
 * {
 *  account: <Object>,
 *  deletedNodeId: <String>,
 * }
 */
exports.deleteServerNode = async params => {
  let account = params.account;
  let deletedNodeId = params.deletedNodeId;
  let broadcast = params.broadcast || false;
  let socket = io.connect(process.env.SERVICE_URL);

  var options = {
    resolveWithFullResponse: true,
    method: "DELETE",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      deletedNodeId,
    headers: {
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    let response = await request(options);

    if (response.statusCode == 204) {
      console.log( 'Deleted', deletedNodeId );
      
      // Find the path of the node id, so that we can broadcast it to other clients.
      let record = await nodeModel.getOneByNodeId({
        account: account,
        nodeId: deletedNodeId
      });

      // Broadcast a notification so that other clients get notified and can download the stuff on their local
      if (broadcast === true) {
        socket.emit("sync-notification", {
          machine_id: machineID.machineIdSync(),
          instance_url: account.instance_url,
          username: account.username,
          node_id: deletedNodeId,
          action: "DELETE",
          is_file: "false",
          is_folder: "false",
          path: `documentLibrary/${record.file_path.replace(
            account.sync_path + "/",
            ""
          )}`
        });
      }

      // Delete the record from the DB
      await nodeModel.delete({
        account: account,
        nodeId: deletedNodeId
      });

      // Add an event log
      await eventLogModel.add(
        account.id,
        "DELETE_NODE",
        `Deleting NodeId: ${deletedNodeId} from ${account.instance_url}`
      );
    }

    return response.statusCode;
  } catch (error) {
    // Looks like the node was not available on the server, no point in keeping the record in the DB
    // So lets delete it
    if (error.statusCode == 404) {
      await nodeModel.delete({
        account: account,
        nodeId: deletedNodeId
      });
    } else {
      await errorLogModel.add(account.id, error);
    }
  }
};

/**
 *
 * @param object params
 * {
 *  account: Account<Object>,
 *  sourceNodeId: <String>,
 *  destinationPath: <String>,
 * }
 */
exports.download = async params => {
  let account = params.account;
  let sourceNodeId = params.sourceNodeId;
  let destinationPath = params.destinationPath;

  var options = {
    method: "GET",
    url:
      account.instance_url +
      "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
      sourceNodeId +
      "/content?attachment=true",
    headers: {
      authorization: "Basic " + (await token.get(account))
    }
  };

  try {
    console.log("Downloading", destinationPath);

    await request(options).pipe(fs.createWriteStream(destinationPath));

    // fs.watchFile(destinationPath, function() {
    //   fs.stat(destinationPath, function(err, stats) {
    //     // Set the sync completed time and also set issync flag to off
    //     await accountModel.syncComplete(account.id);
    //   });
    // });

    // Add refrence to the nodes table
    await nodeModel.add({
      account: account,
      nodeId: sourceNodeId,
      filePath: destinationPath,
      fileUpdateAt: _base.getFileModifiedTime(destinationPath),
      isFolder: false,
      isFile: true
    });

    // Add an event log
    await eventLogModel.add(
      account.id,
      "DOWNLOAD_FILE",
      `Downloading File: ${destinationPath} from ${account.instance_url}`
    );
    return params;
  } catch (error) {
    await errorLogModel.add(account.id, error);
  }
};

/**
 *
 * @param object params
 * {
 *  account: <Object>,
 *  filePath: <String>,
 *  rootNodeId: <String>,
 *  uploadDirectory: <String>,
 * }
 */
exports.upload = async params => {
  let account = params.account;
  let filePath = params.filePath;
  let rootNodeId = params.rootNodeId;
  let broadcast = params.broadcast || false;
  let options = {};

  if (!account) {
    throw new Error("Account not found");
  }

  let socket = io.connect(process.env.SERVICE_URL);

  // If its a directory, send a request to create the directory.
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    let directoryName = path.basename(params.filePath);
    let relativePath = filePath.replace(account.sync_path + "/", "");
    relativePath = relativePath.substring(
      0,
      relativePath.length - directoryName.length - 1
    );

    options = {
      resolveWithFullResponse: true,
      method: "POST",
      url:
        account.instance_url +
        "/alfresco/api/-default-/public/alfresco/versions/1/nodes/" +
        rootNodeId +
        "/children",
      headers: {
        "content-type": "application/json",
        Authorization: "Basic " + (await token.get(account))
      },
      body: JSON.stringify({
        name: directoryName,
        nodeType: "cm:folder",
        relativePath: relativePath
      })
    };

    try {
      let response = await request(options);
      response = JSON.parse(response.body);

      if (response.entry.id) {
        console.log("Uploaded Folder", params.filePath);

        // Broadcast a notification so that other clients get notified and can download the stuff on their local
        if (broadcast === true) {
          socket.emit("sync-notification", {
            machine_id: machineID.machineIdSync(),
            instance_url: account.instance_url,
            username: account.username,
            node_id: response.entry.id,
            action: "CREATE",
            is_file: "false",
            is_folder: "true",
            path: relativePath
              ? `documentLibrary/${relativePath}/${directoryName}`
              : `documentLibrary/${directoryName}`
          });
        }

        // Add a record in the db
        await nodeModel.add({
          account: account,
          nodeId: response.entry.id,
          filePath: params.filePath,
          fileUpdateAt: _base.getFileModifiedTime(params.filePath),
          isFolder: true,
          isFile: false
        });

        // Add an event log
        await eventLogModel.add(
          account.id,
          "UPLOAD_FOLDER",
          `Uploaded Folder: ${filePath} to ${account.instance_url}`
        );
        return response.entry.id;
      }
    } catch (error) {
      // Ignore "duplicate" status codes
      if (error.statusCode != 409) {
        // Add an error log
        await errorLogModel.add(account.id, error);
      }
    }

    return false;
  }

  // If its a file, send a request to upload the file.
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    let uploadDirectory = path.dirname(filePath);
    uploadDirectory = uploadDirectory
      .replace(account.sync_path, "")
      .substring(1);

    options = {
      resolveWithFullResponse: true,
      method: "POST",
      url: account.instance_url + "/alfresco/service/api/upload",
      headers: {
        Authorization: "Basic " + (await token.get(account))
      },
      formData: {
        filedata: {
          value: fs.createReadStream(filePath),
          options: {}
        },
        filename: path.basename(filePath),
        destination: "workspace://SpacesStore/" + rootNodeId,
        uploadDirectory: uploadDirectory,
        overwrite: "true"
      }
    };

    try {
      let response = await request(options);
      response = JSON.parse(response.body);
      let refId = response.nodeRef.split("workspace://SpacesStore/");

      if (refId[1]) {
        console.log("Uploaded File", filePath);

        // Broadcast a notification so that other clients get notified and can download the stuff on their local
        if (broadcast === true) {
          socket.emit("sync-notification", {
            machine_id: machineID.machineIdSync(),
            instance_url: account.instance_url,
            username: account.username,
            node_id: refId[1],
            action: "CREATE",
            is_file: "true",
            is_folder: "false",
            path: uploadDirectory
              ? `documentLibrary/${uploadDirectory}/${path.basename(filePath)}`
              : `documentLibrary/${path.basename(filePath)}`
          });
        }

        // Add a record in the db
        await nodeModel.add({
          account: account,
          nodeId: refId[1],
          filePath: params.filePath,
          fileUpdateAt: _base.getFileModifiedTime(filePath),
          isFolder: false,
          isFile: true
        });

        // Add an event log
        await eventLogModel.add(
          account.id,
          "UPLOAD_FILE",
          `Uploaded File: ${filePath} to ${account.instance_url}`
        );
        return refId[1];
      }

      return false;
    } catch (error) {
      await errorLogModel.add(account.id, error);
    }
  }

  return false;
};
