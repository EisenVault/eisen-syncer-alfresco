const express = require("express");
const router = express.Router();

// Controllers
const parentNodeController = require("../controllers/parent-node");

router.get("/:account_id/:node_id", parentNodeController.getAll);

module.exports = router;
