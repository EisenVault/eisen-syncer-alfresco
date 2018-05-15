const express = require("express");
const router = express.Router();

// Middlewares
const eventLogAddMiddleware = require("../../middlewares/logs/event");

// Controllers
const eventController = require("../../controllers/logs/event");

router.get("/", eventController.getAll);
router.get("/:id", eventController.getOne);
router.post("/", eventLogAddMiddleware, eventController.add);

module.exports = router;
