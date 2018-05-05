const express = require("express");
const router = express.Router();

// Middlewares
const instanceMiddleware = require("../middlewares/accounts/instance");

// Controllers
const accountController = require("../controllers/account");

router.get("/", accountController.getAll);
router.get("/:id", accountController.getOne);
router.post("/add-instance", instanceMiddleware, accountController.addInstance);
router.put("/update-instance", instanceMiddleware, accountController.updateInstance);
router.delete("/delete-instance", instanceMiddleware, accountController.deleteInstance);

module.exports = router;
