const express = require("express");
const router = express.Router();

// Middlewares
const settingAddMiddleware = require("../middlewares/settings/add");
const settingUpdateMiddleware = require("../middlewares/settings/update");

// Controllers
const settingController = require("../controllers/setting");

router.get("/", settingController.getAll);
router.get("/:name", settingController.getOne);
router.post("/", settingAddMiddleware, settingController.add);
router.put("/:name", settingUpdateMiddleware, settingController.update);

module.exports = router;
