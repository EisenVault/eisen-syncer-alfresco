const express = require("express");
const router = express.Router();

// Middlewares
const watcherDownloadMiddleware = require("../middlewares/watchers/download");
const watcherAddMiddleware = require("../middlewares/watchers/add");
const watcherDeleteMiddleware = require("../middlewares/watchers/delete");
const watcherUploadMiddleware = require("../middlewares/watchers/upload");

// Controllers
const watcherController = require("../controllers/watcher");

router.get("/download", watcherDownloadMiddleware, watcherController.download);
router.post("/upload", watcherUploadMiddleware, watcherController.upload);
router.post("/", watcherAddMiddleware, watcherController.add);
router.delete("/", watcherDeleteMiddleware, watcherController.remove);

module.exports = router;
