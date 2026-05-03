const mongoose = require("mongoose");

/**
 * User model — lưu trữ thông tin xác thực trong MongoDB.
 *
 * Thay đổi so với bản gốc:
 *  - Thêm trường twoFactorSecret   : lưu TOTP secret (mã hoá base32)
 *  - Thêm trường twoFactorEnabled  : bật/tắt 2FA
 *  - Thêm trường twoFactorBackup   : mảng backup codes (đã hash)
 *  - Thêm trường loginAttempts     : đếm số lần đăng nhập sai
 *  - Thêm trường lockUntil         : khoá tài khoản tạm thời sau nhiều lần sai
 *  - Thêm trường jwtVersion        : dùng để vô hiệu hoá toàn bộ JWT cũ khi đổi mật khẩu
 */
const UserSchema = new mongoose.Schema(
  {
    streamUserId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    // select: false — không bao giờ trả về trong query thường
    hashedPassword: {
      type: String,
      required: true,
      select: false,
    },

    // ── 2FA ──────────────────────────────────────────────────────────
    twoFactorSecret: {
      type: String,
      default: null,
      select: false,          // không bao giờ lộ secret ra ngoài
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorBackupCodes: {
      type: [String],         // mảng bcrypt hash của 8 backup codes
      default: [],
      select: false,
    },

    // ── Account lockout ───────────────────────────────────────────────
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },

    // ── JWT version — tăng lên khi đổi mật khẩu / logout all ─────────
    jwtVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ── Virtual: tài khoản có đang bị khoá không ─────────────────────────
UserSchema.virtual("isLocked").get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

// ── Method: xử lý đăng nhập sai ─────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 phút

UserSchema.methods.incLoginAttempts = async function () {
  // Nếu khoá đã hết hạn → reset
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const update = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= MAX_ATTEMPTS) {
    update.$set = { lockUntil: new Date(Date.now() + LOCK_DURATION_MS) };
  }
  return this.updateOne(update);
};

UserSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
};

module.exports = mongoose.model("User", UserSchema);