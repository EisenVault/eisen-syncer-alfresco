const express = require("express");
const router = express.Router();

// Controllers
const errorController = require("../../controllers/logs/error");

router.get("/", errorController.getAll);
router.get("/:account_id", errorController.getAllByAccountId);

module.exports = router;
