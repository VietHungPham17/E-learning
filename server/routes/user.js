const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  authenticateToken,
  requireAdmin,
  requireTeacherOrAdmin,
} = require("../middleware/authMiddleware.js");
const {
  getAllUsers,
  updateUserRole,
  deleteUser,
  getCurrentUser,
  updateProfile,
  changePassword,
  verifyUserData,
  getUserById,
  updateUserByAdmin,
  resetUserPassword,
} = require("../controllers/user.js");
const { validateNewPasswordMiddleware } = require("../utils/passwordValidator");
const { getChannelKey }  = require("../controllers/channelKey.js");
const { createChannel } = require("../controllers/channelController.js");

const router = express.Router();

// Rate limit cho đổi mật khẩu: tối đa 5 lần / 15 phút
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Quá nhiều lần đổi mật khẩu. Vui lòng thử lại sau 15 phút." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/me", authenticateToken, getCurrentUser);

router.get("/users", authenticateToken, requireAdmin, getAllUsers);

router.put(
  "/users/:userId/role",
  authenticateToken,
  requireAdmin,
  updateUserRole
);

router.delete("/users/:userId", authenticateToken, requireAdmin, deleteUser);

router.put("/profile", authenticateToken, updateProfile);

router.put(
  "/change-password",
  authenticateToken,
  changePasswordLimiter,
  validateNewPasswordMiddleware,
  changePassword
);

router.get("/verify", authenticateToken, verifyUserData);

router.get("/users/:userId", authenticateToken, requireTeacherOrAdmin, getUserById);

router.put(
  "/users/:userId",
  authenticateToken,
  requireAdmin,
  updateUserByAdmin
);

router.put(
  "/users/:userId/reset-password",
  authenticateToken,
  requireAdmin,
  validateNewPasswordMiddleware,
  resetUserPassword
);

// Channel AES key — POST to avoid URL-encoding issues with channel CIDs (e.g. "team:abc")
router.post("/channel-key", authenticateToken, getChannelKey);

// Tạo channel qua server (dùng admin credentials để tránh lỗi phân quyền Stream)
router.post("/channels", authenticateToken, createChannel);

module.exports = router;