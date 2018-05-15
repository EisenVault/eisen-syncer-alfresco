const express = require("express");
const router = express.Router();

// Middlewares
const errorLogAddMiddleware = require("../../middlewares/logs/error");

// Controllers
const errorController = require("../../controllers/logs/error");

router.get("/", errorController.getAll);
router.get("/:id", errorController.getOne);
router.post("/", errorLogAddMiddleware, errorController.add);

module.exports = router;
