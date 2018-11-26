const express = require("express");
const router = express.Router();

// Middlewares
const accountAddMiddleware = require("../middlewares/accounts/add");
const accountCredentialsMiddleware = require("../middlewares/accounts/credential");
const accountSyncPathMiddleware = require("../middlewares/accounts/syncpath");
const accountUpdateSyncMiddleware = require("../middlewares/accounts/sync");

// Controllers
const accountController = require("../controllers/account");

router.get("/", accountController.getAll);
router.get("/:id", accountController.getOne);
router.post("/", accountAddMiddleware, accountController.addAccount);
router.put("/:id", accountAddMiddleware, accountController.updateAccount);
router.put("/credentials/:id", accountCredentialsMiddleware, accountController.updateCredentials);
router.put("/sync_path/:id", accountSyncPathMiddleware, accountController.updateSyncPath);
router.put("/:id/sync", accountUpdateSyncMiddleware, accountController.updateSync);
router.post("/:id/watchnode", accountController.addWatchNodes);
router.put("/:id/synctime", accountController.updateSyncTime);
router.delete("/:id/force_delete/:force_delete", accountController.deleteAccount);

module.exports = router;
