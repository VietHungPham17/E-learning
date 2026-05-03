/**
 * routes/auth.js
 *
 * POST /auth/signup          — Đăng ký
 * POST /auth/login           — Đăng nhập (trả tempToken nếu 2FA bật)
 * POST /auth/2fa/validate    — Nhập TOTP sau login để lấy JWT thật
 * POST /auth/2fa/setup       — [Cần đăng nhập] Bắt đầu thiết lập 2FA
 * POST /auth/2fa/verify-setup— [Cần đăng nhập] Xác nhận TOTP lần đầu
 * POST /auth/2fa/disable     — [Cần đăng nhập] Tắt 2FA
 * POST /auth/refresh         — Làm mới accessToken bằng refreshToken
 * POST /auth/logout          — Đăng xuất (vô hiệu hoá token cũ)
 */

const express  = require("express");
const rateLimit = require("express-rate-limit");

const {
  signup,
  login,
  setup2FA,
  verifySetup2FA,
  validate2FA,
  disable2FA,
  refreshToken,
  logout,
} = require("../controllers/auth.js");

const { authenticateToken }      = require("../middleware/authMiddleware");
const { validatePasswordMiddleware } = require("../utils/passwordValidator");

const router = express.Router();

// ── Rate limiters ─────────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Quá nhiều lần đăng nhập thất bại. Thử lại sau 15 phút." },
  standardHeaders: true,
  legacyHeaders:   false,
  skipSuccessfulRequests: true,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: "Quá nhiều tài khoản từ IP này. Thử lại sau 1 giờ." },
  standardHeaders: true,
  legacyHeaders:   false,
});

// Rate limit cho 2FA validate: 5 lần / 5 phút (chống brute force OTP)
const twoFALimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { message: "Quá nhiều lần thử mã 2FA. Thử lại sau 5 phút." },
  standardHeaders: true,
  legacyHeaders:   false,
});

// Rate limit cho refresh token: 30 lần / 15 phút
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: "Quá nhiều yêu cầu làm mới token. Thử lại sau." },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── Routes ────────────────────────────────────────────────────────────

router.post("/signup",  signupLimiter, validatePasswordMiddleware, signup);
router.post("/login",   loginLimiter, login);

// 2FA — bước 2 sau login (không cần JWT vì dùng tempToken bên trong body)
router.post("/2fa/validate",     twoFALimiter, validate2FA);

// 2FA — quản lý (cần đăng nhập)
router.post("/2fa/setup",        authenticateToken, setup2FA);
router.post("/2fa/verify-setup", authenticateToken, verifySetup2FA);
router.post("/2fa/disable",      authenticateToken, disable2FA);

// Token
router.post("/refresh", refreshLimiter, refreshToken);
router.post("/logout",  authenticateToken, logout);

module.exports = router;