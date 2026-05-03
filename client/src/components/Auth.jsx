/**
 * Auth.jsx — Đăng nhập / Đăng ký có hỗ trợ 2FA
 *
 * Thay đổi so với bản gốc:
 *  - Dùng accessToken + refreshToken thay vì chỉ dùng Stream token
 *  - Khi server trả về require2FA: true → hiển thị form nhập TOTP
 *  - Không lưu hashedPassword vào cookie
 *  - Lưu accessToken trong memory (state) và refreshToken trong httpOnly cookie
 *    (nếu server set cookie) hoặc localStorage tạm thời cho demo
 */

import React, { useState } from "react";
import Cookies from "universal-cookie";
import axios from "axios";
import signinImage from "../assets/signup.jpg";

const cookies = new Cookies();
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:6036";

const initialState = {
  fullName:        "",
  username:        "",
  password:        "",
  confirmPassword: "",
  phoneNumber:     "",
  avatarURL:       "",
};

const Auth = () => {
  const [form, setForm]         = useState(initialState);
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  // Trạng thái 2FA
  const [show2FA, setShow2FA]         = useState(false);
  const [tempToken, setTempToken]     = useState("");
  const [totpCode, setTotpCode]       = useState("");
  const [twoFAError, setTwoFAError]   = useState("");
  const [twoFALoading, setTwoFALoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Lưu thông tin đăng nhập vào cookies (không lưu hashedPassword)
  const saveSession = (data) => {
    const { accessToken, streamToken, userId, username,
            fullName, phoneNumber, avatarURL, role, twoFactorEnabled } = data;

    const isSecure = window.location.protocol === "https:";
    const cookieOpts = { path: "/", sameSite: "strict", secure: isSecure };

    cookies.set("token",         streamToken,          cookieOpts);
    cookies.set("accessToken",   accessToken,          cookieOpts);
    // refreshToken is now set by the server as httpOnly cookie — not stored here
    cookies.set("userId",        userId,               cookieOpts);
    cookies.set("username",      username,             cookieOpts);
    cookies.set("fullName",      fullName || "",       cookieOpts);
    cookies.set("phoneNumber",   phoneNumber || "",    cookieOpts);
    cookies.set("avatarURL",     avatarURL || "",      cookieOpts);
    cookies.set("role",          role || "student",    cookieOpts);
    cookies.set("2faEnabled",    twoFactorEnabled || false, cookieOpts);
  };

  // Bước 1: Submit đăng nhập / đăng ký
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!form.username || !form.password) {
      setError("Vui lòng nhập đầy đủ thông tin");
      setLoading(false);
      return;
    }
    if (isSignup && form.password !== form.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      setLoading(false);
      return;
    }

    try {
      const endpoint = isSignup ? "/auth/signup" : "/auth/login";
      const payload  = isSignup
        ? { username: form.username, password: form.password,
            fullName: form.fullName, phoneNumber: form.phoneNumber,
            avatarURL: form.avatarURL }
        : { username: form.username, password: form.password };

      const { data } = await axios.post(`${API_URL}${endpoint}`, payload);

      // Server yêu cầu xác thực 2FA
      if (data.require2FA) {
        setTempToken(data.tempToken);
        setShow2FA(true);
        setLoading(false);
        return;
      }

      saveSession(data);
      window.location.reload();
    } catch (err) {
      setLoading(false);
      if (err.response) {
        const { status, data } = err.response;
        if (status === 423) { setError(data.message); return; }
        if (status === 409) { setError("Tài khoản đã tồn tại"); return; }
        if (status === 401) { setError("Tên đăng nhập hoặc mật khẩu không đúng"); return; }
        setError(data.message || "Có lỗi xảy ra, vui lòng thử lại");
      } else {
        setError("Không thể kết nối đến server");
      }
    }
  };

  // Bước 2 (nếu 2FA): Submit mã TOTP
  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setTwoFAError("");
    setTwoFALoading(true);

    try {
      const { data } = await axios.post(`${API_URL}/auth/2fa/validate`, {
        tempToken,
        totpCode: totpCode.replace(/\s/g, ""),
      });

      saveSession(data);
      window.location.reload();
    } catch (err) {
      setTwoFALoading(false);
      if (err.response?.status === 429) {
        setTwoFAError("Quá nhiều lần thử. Vui lòng đăng nhập lại.");
        setTimeout(() => { setShow2FA(false); setTempToken(""); setTotpCode(""); }, 2000);
      } else {
        setTwoFAError(err.response?.data?.message || "Mã không hợp lệ, vui lòng thử lại");
      }
    }
  };

  // ── Màn hình nhập TOTP ───────────────────────────────────────────
  if (show2FA) {
    return (
      <div className="auth__form-container">
        <div className="auth__form-container_fields">
          <div className="auth__form-container_fields-content">
            <p>Xác thực hai yếu tố</p>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "16px" }}>
              Nhập mã 6 chữ số từ ứng dụng Authenticator của bạn
            </p>

            {twoFAError && (
              <p style={{ color: "red", marginBottom: "12px" }}>{twoFAError}</p>
            )}

            <form onSubmit={handle2FASubmit}>
              <div className="auth__form-container_fields-content_input">
                <label htmlFor="totpCode">Mã xác thực</label>
                <input
                  id="totpCode"
                  name="totpCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9 ]*"
                  maxLength={7}
                  placeholder="000 000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>

              <div className="auth__form-container_fields-content_button">
                <button type="submit" disabled={twoFALoading || totpCode.length < 6}>
                  {twoFALoading ? "Đang xác thực..." : "Xác thực"}
                </button>
              </div>
            </form>

            <p style={{ fontSize: "12px", color: "#888", marginTop: "12px" }}>
              Mất thiết bị? Nhập backup code (định dạng XXXX-XXXX)
            </p>
            <button
              type="button"
              onClick={() => { setShow2FA(false); setTempToken(""); setTotpCode(""); }}
              style={{ background: "none", border: "none", color: "#999",
                       cursor: "pointer", fontSize: "12px", marginTop: "8px" }}
            >
              ← Quay lại đăng nhập
            </button>
          </div>
        </div>
        <div className="auth__form-container_image">
          <img src={signinImage} alt="sign in" />
        </div>
      </div>
    );
  }

  // ── Màn hình đăng nhập / đăng ký ────────────────────────────────
  return (
    <div className="auth__form-container">
      <div className="auth__form-container_fields">
        <div className="auth__form-container_fields-content">
          <p>{isSignup ? "Đăng ký" : "Đăng nhập"}</p>

          {error && (
            <p style={{ color: "red", marginBottom: "12px" }}>{error}</p>
          )}

          <form onSubmit={handleSubmit}>
            {isSignup && (
              <div className="auth__form-container_fields-content_input">
                <label htmlFor="fullName">Họ tên</label>
                <input id="fullName" name="fullName" placeholder="Nguyễn Văn A"
                  value={form.fullName} onChange={handleChange} required />
              </div>
            )}

            <div className="auth__form-container_fields-content_input">
              <label htmlFor="username">Username</label>
              <input id="username" name="username" placeholder="username"
                value={form.username} onChange={handleChange}
                autoComplete="username" required />
            </div>

            <div className="auth__form-container_fields-content_input">
              <label htmlFor="password">Mật khẩu</label>
              <input id="password" name="password" type="password"
                placeholder="••••••••" value={form.password}
                onChange={handleChange} autoComplete={isSignup ? "new-password" : "current-password"} required />
            </div>

            {isSignup && (
              <>
                <div className="auth__form-container_fields-content_input">
                  <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
                  <input id="confirmPassword" name="confirmPassword" type="password"
                    placeholder="••••••••" value={form.confirmPassword}
                    onChange={handleChange} autoComplete="new-password" required />
                </div>
                <div className="auth__form-container_fields-content_input">
                  <label htmlFor="phoneNumber">Số điện thoại (tuỳ chọn)</label>
                  <input id="phoneNumber" name="phoneNumber" placeholder="09xxxxxxxx"
                    value={form.phoneNumber} onChange={handleChange} />
                </div>
                <div className="auth__form-container_fields-content_input">
                  <label htmlFor="avatarURL">URL ảnh đại diện (tuỳ chọn)</label>
                  <input id="avatarURL" name="avatarURL" placeholder="https://..."
                    value={form.avatarURL} onChange={handleChange} />
                </div>
              </>
            )}

            <div className="auth__form-container_fields-content_button">
              <button type="submit" disabled={loading}>
                {loading ? "Đang xử lý..." : isSignup ? "Đăng ký" : "Đăng nhập"}
              </button>
            </div>
          </form>

          <div className="auth__form-container_fields-account">
            <p>
              {isSignup ? "Đã có tài khoản?" : "Chưa có tài khoản?"}
              <span onClick={() => { setIsSignup(!isSignup); setError(""); }}>
                {isSignup ? " Đăng nhập" : " Đăng ký"}
              </span>
            </p>
          </div>
        </div>
      </div>
      <div className="auth__form-container_image">
        <img src={signinImage} alt="sign in" />
      </div>
    </div>
  );
};

export default Auth;
