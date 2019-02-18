const { accountModel } = require("../../models/account");
const { nodeModel } = require("../../models/node");
const { watcherModel } = require("../../models/watcher");
const { workerModel } = require("../../models/worker");
const { settingModel } = require("../../models/setting");
const { add: errorLogAdd } = require("../../models/log-error");

const remote = require('../remote');
const rimraf = require('rimraf');
const fs = require('fs');
const _base = require("./_base");
const _ = require('lodash');

// Logger
const { logger } = require("../logger");

exports.runUpload = async (isRecursive = false) => {
    const setting = await settingModel.findOne({
        where: {
            name: 'SYNC_PAUSE_SECONDS'
        }
    });

    while (true) {

        await _base.sleep(Number(setting.value) * 1000);

        let workerData = await workerModel.findOne({
            order: [
                ['priority', 'DESC'],
                ['id', 'ASC']
            ]
        });

        if (_.isEmpty(workerData)) {
            logger.info('No Worker Data');
            continue;
        }
        logger.info('Worker Started');

        const { dataValues: worker } = workerData;

        // Delete the worker record
        await workerModel.destroy({
            where: {
                id: worker.id
            }
        });

        const accountData = await accountModel.findOne({
            where: {
                id: worker.account_id,
                sync_enabled: true
            }
        });

        if (_.isEmpty(accountData)) {
            continue;
        }

        const { dataValues: account } = { ...accountData };

        const watcherData = await watcherModel.findByPk(worker.watcher_id);

        if (_.isEmpty(watcherData)) {
            continue;
        }

        const { dataValues: watcher } = { ...watcherData };

        // Following cases are possible...
        // Case A: File created or renamed on local, upload it
        // Case B: File modified on local, upload it
        // Case C: File deleted on server, delete on local
        // Case D: If the record is a folder, delete the worker record and proceed next
        // Case E: If the worker record does not need an upload, no point in keeping it in the DB, delete it
        const filePath = worker.file_path;
        const localFileModifiedDate = _base.getFileModifiedTime(filePath);
        const localFileSize = _base.getFileSize(filePath);

        // Get the DB record of the filePath
        let nodeData = await nodeModel.findOne({
            where: {
                account_id: account.id,
                site_id: watcher.site_id,
                file_path: filePath
            }
        });
        const { dataValues: record } = { ...nodeData };

        if (record && record.download_in_progress === true) {
            // If the file stalled
            if (await _base.isStalledDownload(record)) {
                // Process the next worker record
                isRecursive && await exports.runUpload();
            }
            logger.info("Bailed upload, download in progress. " + filePath);
            continue;
        }

        let statSync = null;
        try {
            statSync = fs.statSync(filePath);
        } catch (error) {
            continue;
        }

        // If its a file and its size is 0, bail out
        if (statSync.isFile() && localFileSize === 0) {
            logger.info("Zero file size. Bailing! " + filePath);
            continue;
        }

        // Case A: File created or renamed on local, upload it
        if (!record) {
            logger.info("New file, attempting to upload... > " + filePath);
            remote.upload({
                account,
                watcher,
                filePath,
                rootNodeId: watcher.document_library_node,
                overwrite: "false",
                isNewFile: true
            }, async (uploadCompleted) => {
                // Process the next worker record
                uploadCompleted && isRecursive && await exports.runUpload();
            });
            continue;
        }

        // If the record exists in the DB and has a nodeID
        if (record && record.node_id !== '') {
            // Make a request to the server to get the node details
            const remoteNodeResponse = await remote.getNode({
                account,
                record
            });

            // Give a break if the server throws an internal server error
            if (remoteNodeResponse && (remoteNodeResponse.statusCode === 503 || remoteNodeResponse.statusCode === 500)) {
                logger.info('Pausing since server load seems high. Status code' + remoteNodeResponse.statusCode);
                await _base.sleep(30000);
                continue;
            }

            let remoteNodeResponseBody = {};
            if (remoteNodeResponse && 'body' in remoteNodeResponse) {
                remoteNodeResponseBody = JSON.parse(remoteNodeResponse.body);
            }

            // Case B: File modified on local, upload it
            if (remoteNodeResponse
                && remoteNodeResponse.statusCode === 200
                && record.is_file === true
                && record.download_in_progress === false
                && record.upload_in_progress === false
                && localFileModifiedDate > _base.convertToUTC(remoteNodeResponseBody.entry.modifiedAt)) {
                logger.info("File modified on local, attempting to upload..." + filePath);
                // Upload the local changes to the server.
                await remote.upload({
                    account,
                    watcher,
                    filePath,
                    rootNodeId: watcher.document_library_node,
                    overwrite: "true",
                    isNewFile: false
                }, async (uploadCompleted) => {
                    // Process the next worker record
                    uploadCompleted && isRecursive && await exports.runUpload();
                });
                continue;
            }

            // Case C: File deleted on server? delete on local
            if (remoteNodeResponse && remoteNodeResponse.statusCode === 404 && record.download_in_progress === false && record.upload_in_progress == false) {
                logger.info(
                    "Node not available on server, deleting on local: " + record.file_path + " - " + record.id
                );
                // If the node is not found on the server, delete the file on local
                rimraf(record.file_path, async () => {
                    // Delete the node record
                    await nodeModel.destroy({
                        where: {
                            account_id: account.id,
                            node_id: record.node_id
                        }
                    });
                });

                // Process the next worker record
                isRecursive && await exports.runUpload();
                continue;
            }

            // OR if the node exists on server but that path of node does not match the one with local file path, then delete it from local (possible the file was moved to a different location)
            if (remoteNodeResponse && remoteNodeResponse.statusCode === 200 && remoteNodeResponseBody.entry && remoteNodeResponseBody.entry.path.name !== record.remote_folder_path) {
                logger.info(
                    "Node was moved to some other location, deleting on local: " + record.file_path + " - " + record.id
                );

                rimraf(record.file_path, async () => {
                    await nodeModel.destroy({
                        where: {
                            account_id: account.id,
                            file_path: record.file_path
                        }
                    });
                });

                // Process the next worker record
                isRecursive && await exports.runUpload();
                continue;
            }

            // Process the next worker record
            isRecursive && await exports.runUpload();
            continue;
        }
    }

}