const validator = require("validator");
const _ = require("lodash");

module.exports = (request, response, next) => {
  if (_.isNil(request.body.account_id) || _.isEmpty(request.body.account_id)) {
    return response.status(400).json({
      error: "account_id is mandatory"
    });
  }

  if (
    _.isNil(request.body.root_node_id) ||
    _.isEmpty(request.body.root_node_id)
  ) {
    return response.status(400).json({
      error: "root_node_id is mandatory"
    });
  }

  // if (
  //   _.isNil(request.body.source_path) ||
  //   _.isEmpty(request.body.source_path)
  // ) {
  //   return response.status(400).json({
  //     error: "source_path is mandatory"
  //   });
  // }
  // if (
  //   _.isNil(request.body.destination_node_id) ||
  //   _.isEmpty(request.body.destination_node_id)
  // ) {
  //   return response.status(400).json({
  //     error: "destination_node_id is mandatory"
  //   });
  // }

  // if (
  //   _.isNil(request.body.upload_directory) ||
  //   _.isEmpty(request.body.upload_directory)
  // ) {
  //   return response.status(400).json({
  //     error: "upload_directory is mandatory"
  //   });
  // }

  if (_.isNil(request.body.overwrite) || _.isEmpty(request.body.overwrite)) {
    return response.status(400).json({
      error: "overwrite is mandatory"
    });
  }

  next();
};
