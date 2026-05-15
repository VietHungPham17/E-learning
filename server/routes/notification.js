const express = require("express");
const router  = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const { getNotifications }  = require("../controllers/notificationController");

router.get("/", authenticateToken, getNotifications);

module.exports = router;
