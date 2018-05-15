const express = require("express");
const router = express.Router();

// Middlewares
const watchNodeAddMiddleware = require("../middlewares/watch-node/add");
const watchNodeUpdateMiddleware = require("../middlewares/watch-node/update");

// Controllers
const watchNodeController = require("../controllers/watch-node");

router.get("/:account_id", watchNodeController.getAll);
router.post("/", watchNodeAddMiddleware, watchNodeController.add);
router.put("/:account_id", watchNodeUpdateMiddleware, watchNodeController.update);

module.exports = router;
