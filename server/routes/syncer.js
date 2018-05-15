const express = require("express");
const router = express.Router();

// Middlewares
const syncerDownloadMiddleware = require("../middlewares/syncers/download");
const syncerAddMiddleware = require("../middlewares/syncers/add");
const syncerDeleteMiddleware = require("../middlewares/syncers/delete");
const syncerUploadMiddleware = require("../middlewares/syncers/upload");

// Controllers
const syncerController = require("../controllers/syncer");

router.get("/download", syncerDownloadMiddleware, syncerController.download);
router.post("/upload", syncerUploadMiddleware, syncerController.upload);

module.exports = router;
