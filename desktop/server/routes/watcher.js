const express = require("express");
const router = express.Router();

// Controllers
const watcherController = require("../controllers/watcher");

router.get("/:accountId", watcherController.getAll);

module.exports = router;
