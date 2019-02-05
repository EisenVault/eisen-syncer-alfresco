const { accountModel } = require("../../models/account");
const { nodeModel } = require("../../models/node");
const { watcherModel } = require("../../models/watcher");
const { workerModel } = require("../../models/worker");
const remote = require('../remote');
const rimraf = require('rimraf');
const _base = require("./_base");
const _ = require('lodash');

// Logger
const { logger } = require("../logger");

exports.runUpload = async (isRecursive = true) => {
    let orderIdBy = 'DESC';
    if (isRecursive) {
        orderIdBy = 'ASC';
    }

    let workerData = await workerModel.findOne({
        order: [
            ['priority', 'DESC'],
            ['id', orderIdBy]
        ]
    });

    if (_.isEmpty(workerData)) {
        return;
    }
    logger.info('Worker Started');

    const { dataValues: worker } = workerData;

    const accountData = await accountModel.findByPk(worker.account_id);

    if (_.isEmpty(accountData)) {
        return;
    }

    const { dataValues: account } = { ...accountData };

    const watcherData = await watcherModel.findByPk(worker.watcher_id);

    if (_.isEmpty(watcherData)) {
        return;
    }

    const { dataValues: watcher } = { ...watcherData };

    logger.info('Worker Step 1');
    // Following cases are possible...
    // Case A: File created or renamed on local, upload it
    // Case B: File modified on local, upload it
    // Case C: File deleted on server, delete on local
    // Case D: If the record is a folder, delete the worker record and proceed next
    // Case E: If the worker record does not need an upload, no point in keeping it in the DB, delete it
    const filePath = worker.file_path;
    const localFileModifiedDate = _base.getFileModifiedTime(filePath);
    const localFileSize = _base.getFileSize(filePath);
    logger.info('Worker Step 2');
    // Get the DB record of the filePath
    let nodeData = await nodeModel.findOne({
        where: {
            account_id: account.id,
            file_path: filePath
        }
    });
    const { dataValues: record } = { ...nodeData };
    logger.info('Worker Step 3');
    if (record && record.download_in_progress === true) {
        // If the file stalled
        if (await _base.isStalledDownload(record)) {
            await workerModel.destroy({
                where: {
                    id: worker.id
                }
            });
            // Process the next worker record
            isRecursive && await exports.runUpload();
        }
        logger.info("Bailed upload, download in progress. " + filePath);
        return;
    }
    logger.info('Worker Step 4.');
    // Case A: File created or renamed on local, upload it
    if (!record && localFileSize > 0) {
        logger.info("New file, uploading... > " + filePath);
        remote.upload({
            account,
            watcher,
            filePath,
            rootNodeId: watcher.document_library_node
        }, async (uploadCompleted) => {
            // Process the next worker record
            uploadCompleted && isRecursive && await exports.runUpload();
        });

        // Remove the worker record irrespective of the file being uploaded
        await workerModel.destroy({
            where: {
                id: worker.id
            }
        });
        return;
    }

    logger.info('Worker Step 5');
    // If the record exists in the DB 
    if (record) {
        // Make a request to the server to get the node details
        const remoteNodeResponse = await remote.getNode({
            account,
            record
        });

        // Give a break if the server throws an internal server error
        if (remoteNodeResponse.statusCode !== 200) {
            logger.info('BREAKING SINCE ' + remoteNodeResponse.statusCode);
            return;
        }

        let remoteNodeResponseBody = {};
        if ('body' in remoteNodeResponse) {
            remoteNodeResponseBody = JSON.parse(remoteNodeResponse.body);
        }

        // Case B: File modified on local, upload it
        if (remoteNodeResponse
            && remoteNodeResponse.statusCode === 200
            && record.is_file === true
            && record.download_in_progress === false
            && localFileSize > 0
            && localFileModifiedDate > _base.convertToUTC(remoteNodeResponseBody.entry.modifiedAt)) {
            logger.info("File modified on local, uploading..." + filePath);
            // Upload the local changes to the server.
            await remote.upload({
                account,
                watcher,
                filePath,
                rootNodeId: watcher.document_library_node
            }, async (uploadCompleted) => {
                // Process the next worker record
                uploadCompleted && isRecursive && await exports.runUpload();
            });

            // Remove the worker record irrespective of file being uploaded
            await workerModel.destroy({
                where: {
                    id: worker.id
                }
            });
            return;
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

            // Delete the worker record
            await workerModel.destroy({
                where: {
                    id: worker.id
                }
            });

            // Process the next worker record
            isRecursive && await exports.runUpload();
            return;
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

            // Delete the worker record
            await workerModel.destroy({
                where: {
                    id: worker.id
                }
            });

            // Process the next worker record
            isRecursive && await exports.runUpload();
            return;
        }

        // Case D: If the record is a folder, delete the worker record and proceed next
        // Case E: If the worker record does not need an upload, no point in keeping it in the DB, delete it
        await workerModel.destroy({
            where: {
                id: worker.id
            }
        });

        // Process the next worker record
        isRecursive && await exports.runUpload();
        return;
    }

    // If none of the above criteria met, delete the worker record
    await workerModel.destroy({
        where: {
            id: worker.id
        }
    });
    logger.info('Worker Step 6');
}