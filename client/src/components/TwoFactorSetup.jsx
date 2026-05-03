/**
 * TwoFactorSetup.jsx
 * Component quản lý 2FA trong trang Profile
 *
 * Luồng bật 2FA:
 *   1. Nhấn "Bật 2FA" → gọi POST /auth/2fa/setup → nhận QR code
 *   2. Quét QR bằng Google Authenticator / Authy
 *   3. Nhập mã TOTP 6 số → gọi POST /auth/2fa/verify-setup
 *   4. Hệ thống trả backup codes → hiển thị 1 lần duy nhất
 *
 * Luồng tắt 2FA:
 *   1. Nhập mật khẩu + mã TOTP → gọi POST /auth/2fa/disable
 */

import React, { useState } from "react";
import Cookies from "universal-cookie";
import axios from "axios";

const cookies  = new Cookies();
const API_URL  = process.env.REACT_APP_API_URL || "http://localhost:6036";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${cookies.get("accessToken")}`,
});

const TwoFactorSetup = ({ twoFactorEnabled: initialEnabled, onStatusChange }) => {
  const [step, setStep]               = useState("idle"); // idle | qr | backup | disable
  const [qrCode, setQrCode]           = useState("");
  const [secret, setSecret]           = useState("");
  const [totpCode, setTotpCode]       = useState("");
  const [backupCodes, setBackupCodes] = useState([]);
  const [disableForm, setDisableForm] = useState({ password: "", totpCode: "" });
  const [message, setMessage]         = useState("");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [enabled, setEnabled]         = useState(initialEnabled);

  // ── Bước 1: Lấy QR code ─────────────────────────────────────────
  const handleStartSetup = async () => {
    setError(""); setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/auth/2fa/setup`, {}, {
        headers: getAuthHeaders(),
      });
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("qr");
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi thiết lập 2FA");
    } finally {
      setLoading(false);
    }
  };

  // ── Bước 2: Xác nhận TOTP lần đầu ───────────────────────────────
  const handleVerifySetup = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/auth/2fa/verify-setup`,
        { totpCode: totpCode.replace(/\s/g, "") },
        { headers: getAuthHeaders() }
      );
      setBackupCodes(data.backupCodes);
      setStep("backup");
      setEnabled(true);
      onStatusChange && onStatusChange(true);
    } catch (err) {
      setError(err.response?.data?.message || "Mã TOTP không hợp lệ");
    } finally {
      setLoading(false);
    }
  };

  // ── Tắt 2FA ─────────────────────────────────────────────────────
  const handleDisable = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/2fa/disable`, disableForm, {
        headers: getAuthHeaders(),
      });
      setEnabled(false);
      setStep("idle");
      setMessage("2FA đã được tắt");
      onStatusChange && onStatusChange(false);
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi tắt 2FA");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "16px 0", borderTop: "1px solid var(--color-border-tertiary)" }}>
      <h3 style={{ fontSize: "16px", fontWeight: 500, marginBottom: "8px" }}>
        Xác thực hai yếu tố (2FA)
      </h3>

      <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "16px" }}>
        {enabled
          ? "✅ 2FA đang bật — tài khoản của bạn được bảo vệ tốt hơn"
          : "⚠️  2FA chưa bật — bật lên để tăng bảo mật cho tài khoản"}
      </p>

      {message && <p style={{ color: "green", marginBottom: "12px" }}>{message}</p>}
      {error   && <p style={{ color: "red",   marginBottom: "12px" }}>{error}</p>}

      {/* ── IDLE ── */}
      {step === "idle" && !enabled && (
        <button onClick={handleStartSetup} disabled={loading}
          style={btnStyle("#1a73e8")}>
          {loading ? "Đang tải..." : "Bật 2FA"}
        </button>
      )}

      {step === "idle" && enabled && (
        <button onClick={() => setStep("disable")}
          style={btnStyle("#d93025")}>
          Tắt 2FA
        </button>
      )}

      {/* ── QR CODE ── */}
      {step === "qr" && (
        <div>
          <p style={{ fontSize: "13px", marginBottom: "12px" }}>
            Quét mã QR bằng <strong>Google Authenticator</strong> hoặc <strong>Authy</strong>:
          </p>
          <img src={qrCode} alt="QR Code 2FA" style={{ width: 180, height: 180, display: "block", marginBottom: "12px" }} />
          <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "12px" }}>
            Hoặc nhập thủ công: <code style={{ background: "var(--color-background-secondary)", padding: "2px 6px", borderRadius: 4 }}>{secret}</code>
          </p>
          <form onSubmit={handleVerifySetup}>
            <label style={{ fontSize: "13px", display: "block", marginBottom: "6px" }}>
              Nhập mã 6 số từ ứng dụng để xác nhận:
            </label>
            <input
              type="text" inputMode="numeric" maxLength={7}
              placeholder="000 000" value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              style={inputStyle}
              autoFocus autoComplete="one-time-code"
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button type="submit" disabled={loading || totpCode.length < 6} style={btnStyle("#1a73e8")}>
                {loading ? "Đang xác minh..." : "Xác minh & bật 2FA"}
              </button>
              <button type="button" onClick={() => { setStep("idle"); setQrCode(""); setSecret(""); setTotpCode(""); }}
                style={btnStyle("#888")}>
                Huỷ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── BACKUP CODES ── */}
      {step === "backup" && (
        <div>
          <p style={{ fontWeight: 500, marginBottom: "8px", color: "#e67700" }}>
            ⚠️  Lưu các backup codes này ngay — chúng chỉ hiển thị một lần duy nhất!
          </p>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "12px" }}>
            Dùng backup code khi mất thiết bị xác thực. Mỗi code chỉ dùng được một lần.
          </p>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "6px", background: "var(--color-background-secondary)",
            padding: "12px", borderRadius: "8px", marginBottom: "16px",
            fontFamily: "monospace", fontSize: "14px",
          }}>
            {backupCodes.map((code, i) => (
              <span key={i} style={{ padding: "4px 8px", background: "var(--color-background-primary)",
                borderRadius: "4px", textAlign: "center" }}>
                {code}
              </span>
            ))}
          </div>
          <button onClick={() => {
              navigator.clipboard?.writeText(backupCodes.join("\n"));
              setMessage("Đã sao chép backup codes");
            }} style={btnStyle("#555", "small")}>
            📋 Sao chép tất cả
          </button>
          <button onClick={() => { setStep("idle"); setBackupCodes([]); setMessage("2FA đã được bật thành công! ✅"); }}
            style={{ ...btnStyle("#1a73e8", "small"), marginLeft: "8px" }}>
            Hoàn tất
          </button>
        </div>
      )}

      {/* ── DISABLE ── */}
      {step === "disable" && (
        <form onSubmit={handleDisable}>
          <p style={{ fontSize: "13px", marginBottom: "12px" }}>
            Nhập mật khẩu và mã TOTP hiện tại để tắt 2FA:
          </p>
          <label style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}>Mật khẩu</label>
          <input type="password" placeholder="••••••••"
            value={disableForm.password}
            onChange={(e) => setDisableForm(p => ({ ...p, password: e.target.value }))}
            style={{ ...inputStyle, marginBottom: "12px" }}
          />
          <label style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}>Mã TOTP</label>
          <input type="text" inputMode="numeric" maxLength={7} placeholder="000 000"
            value={disableForm.totpCode}
            onChange={(e) => setDisableForm(p => ({ ...p, totpCode: e.target.value }))}
            style={{ ...inputStyle, marginBottom: "12px" }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" disabled={loading} style={btnStyle("#d93025")}>
              {loading ? "Đang xử lý..." : "Xác nhận tắt 2FA"}
            </button>
            <button type="button" onClick={() => { setStep("idle"); setError(""); }}
              style={btnStyle("#888")}>
              Huỷ
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

const btnStyle = (bg, size = "normal") => ({
  background: bg, color: "#fff", border: "none",
  padding: size === "small" ? "6px 12px" : "8px 16px",
  borderRadius: "6px", cursor: "pointer", fontSize: "13px",
});

const inputStyle = {
  width: "100%", maxWidth: "200px", padding: "8px 10px",
  border: "1px solid var(--color-border-primary)", borderRadius: "6px",
  fontSize: "16px", fontFamily: "monospace", letterSpacing: "4px",
  background: "var(--color-background-primary)",
  color: "var(--color-text-primary)",
  outline: "none", display: "block",
};

export default TwoFactorSetup;
