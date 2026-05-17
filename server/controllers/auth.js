/**
 * controllers/auth.js — ĐĂNG KÝ / ĐĂNG NHẬP + JWT + 2FA (TOTP)
 *
 * Thay đổi so với bản gốc:
 *  [SIGNUP]
 *    - Sửa queryUsers({name}) → queryUsers({name: username}) đúng cách
 *      để kiểm tra trùng username chính xác hơn (kết hợp MongoDB)
 *    - Không trả về hashedPassword trong response
 *    - Ký JWT (access token 15 phút + refresh token 7 ngày) thay vì
 *      chỉ dùng Stream token cho việc xác thực API
 *
 *  [LOGIN]
 *    - Account lockout: khoá 15 phút sau 5 lần sai
 *    - Nếu user bật 2FA → trả về { require2FA: true, tempToken }
 *      thay vì token thật → client phải gửi mã TOTP để lấy token thật
 *    - Sau đăng nhập thành công → reset loginAttempts
 *
 *  [2FA - SETUP]  POST /auth/2fa/setup
 *    - Tạo TOTP secret, trả QR code URI để user quét bằng Google Authenticator
 *    - Chưa bật 2FA cho đến khi user xác nhận bằng verify
 *
 *  [2FA - VERIFY SETUP]  POST /auth/2fa/verify-setup
 *    - Xác nhận mã TOTP lần đầu → lưu secret, bật twoFactorEnabled
 *    - Tạo 8 backup codes (lưu dạng hash, trả về plain text một lần duy nhất)
 *
 *  [2FA - VALIDATE LOGIN]  POST /auth/2fa/validate
 *    - Nhận tempToken + mã TOTP (hoặc backup code) → trả JWT thật
 *
 *  [2FA - DISABLE]  POST /auth/2fa/disable
 *    - Xác nhận mật khẩu + mã TOTP → tắt 2FA
 *
 *  [REFRESH TOKEN]  POST /auth/refresh
 *    - Nhận refreshToken → trả accessToken mới
 *
 *  [LOGOUT]  POST /auth/logout
 *    - Tăng jwtVersion → vô hiệu hoá tất cả token cũ
 */

const { connect } = require("getstream");
const bcrypt      = require("bcrypt");
const crypto      = require("crypto");
const jwt         = require("jsonwebtoken");
const speakeasy   = require("speakeasy");
const qrcode      = require("qrcode");
const StreamChat  = require("stream-chat").StreamChat;
require("dotenv").config();

const User = require("../models/User");
const { validatePassword } = require("../utils/passwordValidator");

const api_key    = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;
const app_id     = process.env.STREAM_APP_ID;
const JWT_SECRET         = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// ── Helpers ───────────────────────────────────────────────────────────

const signAccessToken = (userId, jwtVersion) =>
  jwt.sign({ userId, jwtVersion }, JWT_SECRET, { expiresIn: "15m", algorithm: "HS256" });

const signRefreshToken = (userId, jwtVersion) =>
  jwt.sign({ userId, jwtVersion }, JWT_REFRESH_SECRET, { expiresIn: "7d", algorithm: "HS256" });

// Set refreshToken as httpOnly cookie (JS cannot read it)
// SameSite: "none" in production because client and server are on different
// Render subdomains (cross-origin). Requires Secure:true (already set).
// SameSite: "lax" in development (localhost is same-site across ports).
function setRefreshCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge:   7 * 24 * 60 * 60 * 1000,
    path:     "/",
  });
}

// tempToken dùng cho bước 2FA — hết hạn sau 5 phút
const signTempToken = (userId) =>
  jwt.sign({ userId, is2FATemp: true }, JWT_SECRET, { expiresIn: "5m", algorithm: "HS256" });

const verifyTempToken = (token) => {
  const payload = jwt.verify(token, JWT_SECRET);
  if (!payload.is2FATemp) throw new Error("Token không phải temp 2FA");
  return payload;
};

// Tạo 8 backup codes ngẫu nhiên dạng XXXXXXXX-XXXXXXXX (4 bytes mỗi phần)
const generateBackupCodes = () =>
  Array.from({ length: 8 }, () => {
    const part = () => crypto.randomBytes(4).toString("hex").toUpperCase();
    return `${part()}-${part()}`;
  });

// ── SIGNUP ────────────────────────────────────────────────────────────
const signup = async (req, res) => {
  try {
    const { fullName, username, password, phoneNumber, avatarURL } = req.body;

    // 1. Validate bắt buộc
    if (!fullName || !username || !password) {
      return res.status(400).json({ message: "fullName, username và password là bắt buộc" });
    }

    // Guard against NoSQL operator injection (e.g. username: { $gt: "" })
    if (typeof fullName !== "string" || typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
    }

    // 2. Validate format username
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({
        message: "Username chỉ được chứa chữ cái, số, gạch dưới và có độ dài 3-30 ký tự",
      });
    }

    // 3. Validate mật khẩu
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ message: pwCheck.errors[0], errors: pwCheck.errors });
    }

    // 4. Validate số điện thoại
    if (phoneNumber && !/^[0-9]{10,11}$/.test(phoneNumber)) {
      return res.status(400).json({ message: "Số điện thoại không hợp lệ (10-11 chữ số)" });
    }

    // 5. Validate avatarURL — HTTPS only to prevent javascript:/data: XSS and SSRF
    if (avatarURL && avatarURL.trim()) {
      try {
        const u = new URL(avatarURL);
        if (u.protocol !== "https:") throw new Error();
      } catch { return res.status(400).json({ message: "avatarURL phải là HTTPS" }); }
    }

    // 6. Kiểm tra username trùng — kiểm tra cả MongoDB 
    const existingInDB = await User.findOne({ username: username.toLowerCase() });
    if (existingInDB) {
      return res.status(400).json({ message: "Username không khả dụng, vui lòng chọn username khác" });
    }

    // 7. Hash mật khẩu
    const userId        = crypto.randomBytes(16).toString("hex");
    const hashedPassword = await bcrypt.hash(password, 12);
    const userRole      = "student"; // signup luôn là student; admin tạo role khác qua panel

    // 8. Tạo user trên Stream — KHÔNG có hashedPassword
    const streamClient = StreamChat.getInstance(api_key, api_secret);
    await streamClient.upsertUser({
      id:          userId,
      name:        username,
      fullName:    fullName,
      phoneNumber: phoneNumber || "",
      role:        userRole,
      avatarURL:   avatarURL || "",
    });

    // 9. Lưu vào MongoDB
    const dbUser = await User.create({
      streamUserId: userId,
      username:     username.toLowerCase(),
      hashedPassword,
    });

    // 10. Ký JWT
    const accessToken  = signAccessToken(userId, dbUser.jwtVersion);
    const refreshToken = signRefreshToken(userId, dbUser.jwtVersion);

    // 11. Stream token (cho Stream Chat SDK)
    const serverClient = connect(api_key, api_secret, app_id);
    const streamToken  = serverClient.createUserToken(userId);

    setRefreshCookie(res, refreshToken);
    return res.status(201).json({
      accessToken,
      streamToken,
      userId,
      username,
      fullName,
      phoneNumber: phoneNumber || "",
      role: userRole,
      twoFactorEnabled: false,
    });
  } catch (error) {
    console.error("[SIGNUP ERROR]", error.message);
    return res.status(500).json({ message: "Lỗi máy chủ, vui lòng thử lại sau" });
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "username và password là bắt buộc" });
    }

    // Guard against NoSQL operator injection (e.g. username: { $gt: "" })
    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
    }

    // 1. Tìm trong MongoDB (nguồn sự thật cho auth)
    const dbUser = await User.findOne({ username: username.toLowerCase() })
      .select("+hashedPassword +twoFactorEnabled +twoFactorSecret +twoFactorBackupCodes +loginAttempts +lockUntil +jwtVersion");

    if (!dbUser) {
      // Vẫn chạy bcrypt để tránh timing attack
      await bcrypt.compare(password, "$2b$12$invalidhashtopreventtimingattack000000000000000000000");
      return res.status(401).json({ message: "Tên đăng nhập hoặc mật khẩu không đúng" });
    }

    // 2. Kiểm tra tài khoản bị khoá
    if (dbUser.isLocked) {
      const remaining = Math.ceil((dbUser.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        message: `Tài khoản bị khoá tạm thời. Thử lại sau ${remaining} phút.`,
      });
    }

    // 3. Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, dbUser.hashedPassword);
    if (!isMatch) {
      await dbUser.incLoginAttempts();
      const attemptsLeft = Math.max(0, 5 - (dbUser.loginAttempts + 1));
      return res.status(401).json({
        message: `Tên đăng nhập hoặc mật khẩu không đúng${attemptsLeft > 0 ? `. Còn ${attemptsLeft} lần thử.` : ". Tài khoản sẽ bị khoá."}`,
      });
    }

    // 4. Reset loginAttempts
    await dbUser.resetLoginAttempts();

    // 5. Nếu bật 2FA → trả tempToken, yêu cầu nhập TOTP
    if (dbUser.twoFactorEnabled) {
      const tempToken = signTempToken(dbUser.streamUserId);
      return res.status(200).json({
        require2FA: true,
        tempToken,
        message: "Vui lòng nhập mã xác thực từ ứng dụng Authenticator",
      });
    }

    // 6. Đăng nhập thành công — ký JWT
    const accessToken  = signAccessToken(dbUser.streamUserId, dbUser.jwtVersion);
    const refreshToken = signRefreshToken(dbUser.streamUserId, dbUser.jwtVersion);

    // 7. Lấy thông tin hiển thị từ Stream
    const streamClient = StreamChat.getInstance(api_key, api_secret);
    const { users }    = await streamClient.queryUsers({ id: dbUser.streamUserId });
    const streamUser   = users[0] || {};

    // 8. Stream token
    const serverClient = connect(api_key, api_secret, app_id);
    const streamToken  = serverClient.createUserToken(dbUser.streamUserId);

    setRefreshCookie(res, refreshToken);
    return res.status(200).json({
      accessToken,
      streamToken,
      userId:          dbUser.streamUserId,
      username:        dbUser.username,
      fullName:        streamUser.fullName || "",
      phoneNumber:     streamUser.phoneNumber || "",
      avatarURL:       streamUser.avatarURL || "",
      role:            streamUser.role || "student",
      twoFactorEnabled: dbUser.twoFactorEnabled,
    });
  } catch (error) {
    console.error("[LOGIN ERROR]", error.message);
    return res.status(500).json({ message: "Lỗi máy chủ, vui lòng thử lại sau" });
  }
};

// ── 2FA: SETUP — tạo secret + QR code ────────────────────────────────
const setup2FA = async (req, res) => {
  try {
    const dbUser = await User.findOne({ streamUserId: req.user.id });
    if (!dbUser) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    if (dbUser.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA đã được bật" });
    }

    // Tạo secret TOTP
    const secret = speakeasy.generateSecret({
      name:   `GroupChat Quiz (${dbUser.username})`,
      length: 20,
    });

    // Lưu secret tạm (chưa enable cho đến khi verify thành công)
    await User.updateOne(
      { streamUserId: req.user.id },
      { twoFactorSecret: secret.base32 }
    );

    // Tạo QR code URI
    const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url);

    return res.status(200).json({
      secret:      secret.base32,    // hiển thị để user nhập thủ công nếu cần
      qrCode:      qrCodeDataURL,    // data URL để render <img>
      message:     "Quét QR bằng Google Authenticator hoặc Authy, sau đó gọi /2fa/verify-setup",
    });
  } catch (error) {
    console.error("[2FA SETUP ERROR]", error);
    return res.status(500).json({ message: "Lỗi thiết lập 2FA" });
  }
};

// ── 2FA: VERIFY SETUP — xác nhận mã TOTP lần đầu ────────────────────
const verifySetup2FA = async (req, res) => {
  try {
    const { totpCode } = req.body;
    if (!totpCode) return res.status(400).json({ message: "Vui lòng nhập mã TOTP" });

    const dbUser = await User.findOne({ streamUserId: req.user.id })
      .select("+twoFactorSecret +twoFactorBackupCodes");
    if (!dbUser) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    if (!dbUser.twoFactorSecret) return res.status(400).json({ message: "Chưa setup 2FA" });

    // Xác minh mã TOTP
    const isValid = speakeasy.totp.verify({
      secret:   dbUser.twoFactorSecret,
      encoding: "base32",
      token:    totpCode,
      window:   1, // cho phép lệch ±30 giây
    });

    if (!isValid) {
      return res.status(400).json({ message: "Mã TOTP không hợp lệ" });
    }

    // Tạo backup codes
    const plainCodes  = generateBackupCodes();
    const hashedCodes = await Promise.all(plainCodes.map(c => bcrypt.hash(c, 10)));

    // Bật 2FA
    await User.updateOne(
      { streamUserId: req.user.id },
      {
        twoFactorEnabled:     true,
        twoFactorBackupCodes: hashedCodes,
      }
    );

    return res.status(200).json({
      message:     "2FA đã được bật thành công",
      backupCodes: plainCodes, // Hiển thị DUY NHẤT một lần — user phải lưu lại
    });
  } catch (error) {
    console.error("[2FA VERIFY SETUP ERROR]", error);
    return res.status(500).json({ message: "Lỗi xác minh 2FA" });
  }
};

// ── 2FA: VALIDATE LOGIN — nhập TOTP để lấy JWT thật ─────────────────
const validate2FA = async (req, res) => {
  try {
    const { tempToken, totpCode } = req.body;
    if (!tempToken || !totpCode) {
      return res.status(400).json({ message: "tempToken và totpCode là bắt buộc" });
    }

    // Xác minh tempToken
    let payload;
    try {
      payload = verifyTempToken(tempToken);
    } catch {
      return res.status(401).json({ message: "Phiên xác thực đã hết hạn, vui lòng đăng nhập lại" });
    }

    const dbUser = await User.findOne({ streamUserId: payload.userId })
      .select("+twoFactorSecret +twoFactorBackupCodes +jwtVersion");
    if (!dbUser) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    // Thử xác minh TOTP trước
    const isValidTOTP = speakeasy.totp.verify({
      secret:   dbUser.twoFactorSecret,
      encoding: "base32",
      token:    totpCode,
      window:   1,
    });

    if (!isValidTOTP) {
      // Thử backup codes
      let usedIndex = -1;
      for (let i = 0; i < dbUser.twoFactorBackupCodes.length; i++) {
        if (await bcrypt.compare(totpCode.toUpperCase(), dbUser.twoFactorBackupCodes[i])) {
          usedIndex = i;
          break;
        }
      }
      if (usedIndex === -1) {
        return res.status(401).json({ message: "Mã xác thực không hợp lệ" });
      }
      // Xoá backup code đã dùng (dùng một lần)
      const newCodes = dbUser.twoFactorBackupCodes.filter((_, i) => i !== usedIndex);
      await User.updateOne({ streamUserId: payload.userId }, { twoFactorBackupCodes: newCodes });
    }

    // Ký JWT thật
    const accessToken  = signAccessToken(dbUser.streamUserId, dbUser.jwtVersion);
    const refreshToken = signRefreshToken(dbUser.streamUserId, dbUser.jwtVersion);

    // Lấy info từ Stream
    const streamClient = StreamChat.getInstance(api_key, api_secret);
    const { users }    = await streamClient.queryUsers({ id: dbUser.streamUserId });
    const streamUser   = users[0] || {};

    const serverClient = connect(api_key, api_secret, app_id);
    const streamToken  = serverClient.createUserToken(dbUser.streamUserId);

    setRefreshCookie(res, refreshToken);
    return res.status(200).json({
      accessToken,
      streamToken,
      userId:           dbUser.streamUserId,
      username:         dbUser.username,
      fullName:         streamUser.fullName || "",
      phoneNumber:      streamUser.phoneNumber || "",
      avatarURL:        streamUser.avatarURL || "",
      role:             streamUser.role || "student",
      twoFactorEnabled: true,
    });
  } catch (error) {
    console.error("[2FA VALIDATE ERROR]", error);
    return res.status(500).json({ message: "Lỗi xác thực 2FA" });
  }
};

// ── 2FA: DISABLE ──────────────────────────────────────────────────────
const disable2FA = async (req, res) => {
  try {
    const { password, totpCode } = req.body;
    if (!password || !totpCode) {
      return res.status(400).json({ message: "Mật khẩu và mã TOTP là bắt buộc" });
    }

    const dbUser = await User.findOne({ streamUserId: req.user.id })
      .select("+hashedPassword +twoFactorSecret");
    if (!dbUser) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    const isMatch = await bcrypt.compare(password, dbUser.hashedPassword);
    if (!isMatch) return res.status(401).json({ message: "Mật khẩu không đúng" });

    const isValidTOTP = speakeasy.totp.verify({
      secret:   dbUser.twoFactorSecret,
      encoding: "base32",
      token:    totpCode,
      window:   1,
    });
    if (!isValidTOTP) return res.status(400).json({ message: "Mã TOTP không hợp lệ" });

    await User.updateOne(
      { streamUserId: req.user.id },
      {
        twoFactorEnabled:     false,
        twoFactorSecret:      null,
        twoFactorBackupCodes: [],
      }
    );

    return res.status(200).json({ message: "2FA đã được tắt" });
  } catch (error) {
    console.error("[2FA DISABLE ERROR]", error);
    return res.status(500).json({ message: "Lỗi tắt 2FA" });
  }
};

// ── REFRESH TOKEN ─────────────────────────────────────────────────────
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: "Không có refresh token" });

    let payload;
    try {
      payload = jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
    } catch {
      return res.status(401).json({ message: "Refresh token không hợp lệ hoặc đã hết hạn" });
    }

    const dbUser = await User.findOne({ streamUserId: payload.userId }).select("jwtVersion");
    if (!dbUser || dbUser.jwtVersion !== payload.jwtVersion) {
      return res.status(401).json({ message: "Phiên đăng nhập đã hết hạn" });
    }

    const newAccessToken = signAccessToken(payload.userId, dbUser.jwtVersion);
    return res.status(200).json({ accessToken: newAccessToken });
  } catch (error) {
    console.error("[REFRESH TOKEN ERROR]", error);
    return res.status(500).json({ message: "Lỗi làm mới token" });
  }
};

// ── LOGOUT — vô hiệu hoá tất cả token cũ ────────────────────────────
const logout = async (req, res) => {
  try {
    // Tăng jwtVersion → token cũ không hợp lệ nữa
    await User.updateOne(
      { streamUserId: req.user.id },
      { $inc: { jwtVersion: 1 } }
    );
    const isProd = process.env.NODE_ENV === "production";
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure:   isProd,
      sameSite: isProd ? "none" : "lax",
      path:     "/",
    });
    return res.status(200).json({ message: "Đăng xuất thành công" });
  } catch (error) {
    console.error("[LOGOUT ERROR]", error);
    return res.status(500).json({ message: "Lỗi đăng xuất" });
  }
};

module.exports = {
  signup,
  login,
  setup2FA,
  verifySetup2FA,
  validate2FA,
  disable2FA,
  refreshToken,
  logout,
};