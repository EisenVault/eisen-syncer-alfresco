const express = require("express");
const router = express.Router();

// Middlewares
const eventLogAddMiddleware = require("../../middlewares/logs/event");

// Controllers
const eventController = require("../../controllers/logs/event");

router.get("/", eventController.getAll);
router.get("/:account_id", eventController.getAllByAccountId);
router.post("/", eventLogAddMiddleware, eventController.add);

module.exports = router;
