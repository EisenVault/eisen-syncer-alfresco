const express = require("express");
const router = express.Router();

// Controllers
const nodeController = require("../controllers/node");

router.get("/:account_id/:node_id", nodeController.getAll);

module.exports = router;
