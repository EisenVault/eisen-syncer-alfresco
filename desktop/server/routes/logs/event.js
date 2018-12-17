const express = require("express");
const router = express.Router();

// Controllers
const eventController = require("../../controllers/logs/event");

router.get("/", eventController.getAll);
router.get("/:account_id", eventController.getAllByAccountId);

module.exports = router;
