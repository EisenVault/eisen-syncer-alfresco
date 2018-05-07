const express = require("express");
const router = express.Router();

// Middlewares
const watcherMiddleware = require("../middlewares/watcher");

// Controllers
const watcherController = require("../controllers/watcher");

router.post("/", watcherMiddleware, watcherController.add);
router.delete("/", watcherMiddleware, watcherController.remove);

module.exports = router;
