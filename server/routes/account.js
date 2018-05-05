const express = require("express");
const router = express.Router();

const accountController = require("../controllers/account");

router.get("/", accountController.getAll);

module.exports = router;
