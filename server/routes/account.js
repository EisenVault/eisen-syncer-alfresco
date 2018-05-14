const express = require("express");
const router = express.Router();

// Middlewares
const accountMiddleware = require("../middlewares/account");

// Controllers
const accountController = require("../controllers/account");

router.get("/", accountController.getAll);
router.get("/:id", accountController.getOne);
router.post("/", accountMiddleware, accountController.addAccount);
router.put("/:id", accountMiddleware, accountController.updateAccount);
router.delete("/:id", accountController.deleteAccount);

module.exports = router;
