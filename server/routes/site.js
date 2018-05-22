const express = require("express");
const router = express.Router();

// Controllers
const siteController = require("../controllers/site");

router.get("/:account_id", siteController.getAll);

module.exports = router;
