/**
 * rbac.js — Nguồn sự thật duy nhất cho xác thực + phân quyền
 *
 * Tất cả route đều dùng middleware từ file này (thông qua authMiddleware.js
 * hoặc quizAuth.js, vốn chỉ là thin re-export).
 *
 * Luồng:
 *   1. authenticate  — xác minh JWT, kiểm tra jwtVersion, lấy role từ Stream
 *                      → gán req.user = { id, name, fullName, role }
 *   2. requireRole   — kiểm tra role đồng bộ (phải chạy SAU authenticate)
 *
 * Ba vai trò hợp lệ: "admin" | "teacher" | "student"
 */

const jwt       = require("jsonwebtoken");
const StreamChat = require("stream-chat").StreamChat;
const User      = require("../models/User");

require("dotenv").config();

const api_key    = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;

// ── 1. authenticate ───────────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Không có token xác thực" });
    }

    // Xác minh chữ ký + hạn dùng
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      const msg =
        err.name === "TokenExpiredError"
          ? "Token đã hết hạn, vui lòng đăng nhập lại"
          : "Token không hợp lệ";
      return res.status(401).json({ message: msg });
    }

    // Từ chối tempToken 2FA — chỉ dùng được ở /auth/2fa/validate
    if (payload.is2FATemp) {
      return res.status(401).json({ message: "Token không hợp lệ" });
    }

    const { userId, jwtVersion } = payload;

    // Kiểm tra jwtVersion — vô hiệu hoá token cũ khi đổi mật khẩu / logout-all
    const dbUser = await User.findOne({ streamUserId: userId }).select("jwtVersion");
    if (!dbUser) {
      return res.status(401).json({ message: "Tài khoản không tồn tại" });
    }
    if (dbUser.jwtVersion !== jwtVersion) {
      return res.status(401).json({
        message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",
      });
    }

    // Lấy thông tin + role từ Stream (nguồn sự thật duy nhất về role)
    const client = StreamChat.getInstance(api_key, api_secret);
    const { users } = await client.queryUsers({ id: userId });
    if (!users?.length) {
      return res.status(401).json({ message: "Không tìm thấy người dùng" });
    }

    const u = users[0];
    req.user = {
      id:       u.id,
      name:     u.name,
      fullName: u.fullName || u.name,
      role:     u.role || "student",
    };

    next();
  } catch (error) {
    console.error("[RBAC] authenticate error:", error);
    return res.status(500).json({ message: "Lỗi xác thực" });
  }
};

// ── 2. requireRole ────────────────────────────────────────────────────────────
// Phải chạy SAU authenticate (cần req.user đã được set).
// Dùng: requireRole("admin"), requireRole("admin", "teacher"), v.v.
const requireRole = (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Chưa xác thực" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Không có quyền. Yêu cầu vai trò: ${roles.join(" hoặc ")}`,
      });
    }
    next();
  };

// ── Shortcuts ─────────────────────────────────────────────────────────────────
const requireAdmin          = requireRole("admin");
const requireTeacherOrAdmin = requireRole("admin", "teacher");
const requireStudent        = requireRole("student");

module.exports = {
  authenticate,
  requireRole,
  requireAdmin,
  requireTeacherOrAdmin,
  requireStudent,
};
