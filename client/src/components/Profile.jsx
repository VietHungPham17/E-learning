import React, { useState, useEffect } from "react";
import "./Profile.css";
import Cookies from "universal-cookie";
import { StreamChat } from "stream-chat";
import apiClient from "../services/apiClient";
import TwoFactorSetup from "./TwoFactorSetup";

const api_key = process.env.REACT_APP_STREAM_API_KEY;

const cookies = new Cookies();

export default function Profile({ activeProfileTab, onBack, isCollapsed }) {
  const [userInfo, setUserInfo] = useState({
    fullName: "",
    username: "",
    phoneNumber: "",
    avatarURL: "",
    role: "",
  });

  const [formData, setFormData] = useState({
    username: "",
    fullName: "",
    phoneNumber: "",
    avatarURL: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const username = cookies.get("username");
        const fullName = cookies.get("fullName");
        const phoneNumber = cookies.get("phoneNumber");
        const avatarURL = cookies.get("avatarURL");
        const role = cookies.get("role");
        const token = cookies.get("token");

        const initialUserInfo = {
          fullName: fullName || "",
          username: username || "",
          phoneNumber: phoneNumber || "",
          avatarURL: avatarURL || "",
          role: role || "student",
          token: token || "",
        };

        setUserInfo(initialUserInfo);
        setFormData({
          username: username || "",
          fullName: fullName || "",
          phoneNumber: phoneNumber || "",
          avatarURL: avatarURL || "",
        });
      } catch (error) {
        console.error("Error loading user info:", error);
        setMessage("Không thể tải thông tin người dùng");
        setMessageType("error");
      }
    };

    loadUserInfo();
  }, []);

  useEffect(() => {
    const hasProfileChanges =
      formData.username !== userInfo.username ||
      formData.fullName !== userInfo.fullName ||
      formData.phoneNumber !== userInfo.phoneNumber ||
      formData.avatarURL !== userInfo.avatarURL;

    const hasPasswordChanges =
      passwordData.currentPassword ||
      passwordData.newPassword ||
      passwordData.confirmPassword;

    setHasChanges(hasProfileChanges || hasPasswordChanges);
  }, [formData, passwordData, userInfo]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (message) {
      setMessage("");
      setMessageType("");
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (message) {
      setMessage("");
      setMessageType("");
    }
  };

  const validateProfileForm = () => {
    if (formData.username !== undefined && !formData.username.trim()) {
      setMessage("Username không được để trống");
      setMessageType("error");
      return false;
    }

    if (formData.fullName !== undefined && !formData.fullName.trim()) {
      setMessage("Họ và tên không được để trống");
      setMessageType("error");
      return false;
    }

    if (formData.phoneNumber !== undefined && !formData.phoneNumber.trim()) {
      setMessage("Số điện thoại không được để trống");
      setMessageType("error");
      return false;
    }

    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(formData.phoneNumber)) {
      setMessage("Số điện thoại không hợp lệ");
      setMessageType("error");
      return false;
    }

    return true;
  };

  const validatePasswordForm = () => {
    if (!passwordData.currentPassword) {
      setMessage("Vui lòng nhập mật khẩu hiện tại");
      setMessageType("error");
      return false;
    }

    if (!passwordData.newPassword) {
      setMessage("Vui lòng nhập mật khẩu mới");
      setMessageType("error");
      return false;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage("Mật khẩu mới phải có ít nhất 6 ký tự");
      setMessageType("error");
      return false;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage("Mật khẩu xác nhận không khớp");
      setMessageType("error");
      return false;
    }

    return true;
  };

  const handleSaveProfile = async () => {
    if (!validateProfileForm()) {
      return;
    }

    setLoading(true);
    try {
      await apiClient.put("/api/profile", {
        ...(formData.username !== userInfo.username && {
          username: formData.username,
        }),
        ...(formData.fullName !== userInfo.fullName && {
          fullName: formData.fullName,
        }),
        ...(formData.phoneNumber !== userInfo.phoneNumber && {
          phoneNumber: formData.phoneNumber,
        }),
        ...(formData.avatarURL !== userInfo.avatarURL && {
          avatarURL: formData.avatarURL,
        }),
      });

      const updatedUserInfo = { ...userInfo };

      if (formData.username !== userInfo.username) {
        cookies.set("username", formData.username);
        updatedUserInfo.username = formData.username;
      }
      if (formData.fullName !== userInfo.fullName) {
        cookies.set("fullName", formData.fullName);
        updatedUserInfo.fullName = formData.fullName;
      }
      if (formData.phoneNumber !== userInfo.phoneNumber) {
        cookies.set("phoneNumber", formData.phoneNumber);
        updatedUserInfo.phoneNumber = formData.phoneNumber;
      }
      if (formData.avatarURL !== userInfo.avatarURL) {
        cookies.set("avatarURL", formData.avatarURL);
        updatedUserInfo.avatarURL = formData.avatarURL;
      }

      setUserInfo(updatedUserInfo);

      try {
        const client = StreamChat.getInstance(api_key);
        if (client.user) {
          await client.upsertUser({
            id: client.user.id,
            username: formData.username.trim(),
            name: formData.username.trim(),
            fullName: formData.fullName.trim(),
            phoneNumber: formData.phoneNumber.trim(),
            avatarURL: formData.avatarURL.trim(),
            hashedPassword: client.user.hashedPassword,
          });

          console.log(
            "StreamChat client updated with new fullName for message display",
          );
        }
      } catch (clientError) {
        console.warn("Could not update StreamChat client:", clientError);
      }

      setMessage(
        "✅ Cập nhật thông tin cá nhân thành công! Họ tên mới sẽ hiển thị trong chat, các thông tin khác giữ nguyên.",
      );
      setMessageType("success");

      console.log("Profile updated successfully. Updated fields:", {
        username: formData.username,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        avatarURL: formData.avatarURL,
      });

      setTimeout(() => {
        setMessage("");
        setMessageType("");
      }, 6036);
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage(error.message || "Cập nhật thông tin thất bại");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!validatePasswordForm()) {
      return;
    }

    setLoading(true);
    try {
      await apiClient.put("/api/change-password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      setMessage(
        "🔒 Thay đổi mật khẩu thành công! Chỉ mật khẩu được cập nhật, tất cả thông tin tài khoản khác giữ nguyên.",
      );
      setMessageType("success");

      console.log(
        "Password changed successfully. Other account info preserved.",
      );

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        setMessage("");
        setMessageType("");
      }, 6036);
    } catch (error) {
      console.error("Error changing password:", error);
      setMessage(error.message || "Thay đổi mật khẩu thất bại");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const renderProfileInfo = () => (
    <div className="profile-form">
      <div className="form-section">
        <h4>Thông tin cá nhân</h4>

        <div className="form-group">
          <label>Username (đăng nhập và hiển thị trong hệ thống)</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            placeholder="Nhập username"
          />
          <small className="field-description">
            Username dùng để đăng nhập và định danh tài khoản trong hệ thống
          </small>
        </div>

        <div className="form-group">
          <label>Họ và tên (hiển thị trong chat)</label>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            placeholder="Nhập họ và tên"
          />
          <small className="field-description">
            Tên này sẽ hiển thị cho người khác trong chat và khi tạo channel mới
          </small>
        </div>

        <div className="form-group">
          <label>Số điện thoại</label>
          <input
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleInputChange}
            placeholder="Nhập số điện thoại"
          />
        </div>

        <div className="form-group">
          <label>Avatar URL</label>
          <input
            type="url"
            name="avatarURL"
            value={formData.avatarURL}
            onChange={handleInputChange}
            placeholder="Nhập đường link ảnh đại diện (tùy chọn)"
          />
          <small className="field-description">
            Đường link đến ảnh đại diện của bạn. Để trống nếu muốn sử dụng ảnh
            mặc định
          </small>
        </div>

        <div className="form-group">
          <label>Vai trò</label>
          <input
            type="text"
            value={
              userInfo.role === "admin"
                ? "Quản trị viên"
                : userInfo.role === "teacher"
                  ? "Giáo viên"
                  : "Học sinh"
            }
            disabled
            className="disabled"
          />
        </div>

        {hasChanges && (
          <div className="form-actions">
            <button
              type="button"
              className="save-btn"
              onClick={handleSaveProfile}
              disabled={loading}
            >
              {loading ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderPasswordChange = () => (
    <div className="profile-form">
      <div className="form-section">
        <h4>Thay đổi mật khẩu</h4>
        <p className="section-description">
          Để bảo mật tài khoản, hãy thường xuyên thay đổi mật khẩu
        </p>

        <div className="form-group">
          <label>Mật khẩu hiện tại</label>
          <input
            type="password"
            name="currentPassword"
            value={passwordData.currentPassword}
            onChange={handlePasswordChange}
            placeholder="Nhập mật khẩu hiện tại"
          />
        </div>

        <div className="form-group">
          <label>Mật khẩu mới</label>
          <input
            type="password"
            name="newPassword"
            value={passwordData.newPassword}
            onChange={handlePasswordChange}
            placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
          />
        </div>

        <div className="form-group">
          <label>Xác nhận mật khẩu mới</label>
          <input
            type="password"
            name="confirmPassword"
            value={passwordData.confirmPassword}
            onChange={handlePasswordChange}
            placeholder="Nhập lại mật khẩu mới"
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="save-btn"
            onClick={handleChangePassword}
            disabled={loading}
          >
            {loading ? "Đang thay đổi..." : "Thay đổi mật khẩu"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`profile-container ${isCollapsed ? "collapsed" : ""}`}>
      <div className="profile-header">
        <h2>
          {activeProfileTab === "info"
            ? "Thông tin cá nhân"
            : activeProfileTab === "password"
            ? "Thay đổi mật khẩu"
            : "Bảo mật (2FA)"}
        </h2>
      </div>

      <div className="profile-content">
        <div className="profile-avatar-section">
          <div className="avatar-large">
            {formData.avatarURL || userInfo.avatarURL ? (
              <img
                src={formData.avatarURL || userInfo.avatarURL}
                alt="Avatar"
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "flex";
                }}
              />
            ) : null}
            <span
              style={{
                display:
                  formData.avatarURL || userInfo.avatarURL ? "none" : "flex",
              }}
            >
              {userInfo.fullName?.[0]?.toUpperCase() ||
                userInfo.username?.[0]?.toUpperCase() ||
                "U"}
            </span>
          </div>
          <div className="avatar-info">
            <h3>{userInfo.fullName || userInfo.username}</h3>
            <p>@{userInfo.username}</p>
            <span className="status online">
              {userInfo.role === "admin"
                ? "Quản trị viên"
                : userInfo.role === "teacher"
                  ? "Giáo viên"
                  : "Học sinh"}
            </span>
          </div>
        </div>

        {activeProfileTab === "info"
          ? renderProfileInfo()
          : activeProfileTab === "password"
          ? renderPasswordChange()
          : <TwoFactorSetup twoFactorEnabled={cookies.get("2faEnabled") === "true"} />}

        {message && <div className={`message ${messageType}`}>{message}</div>}
      </div>
    </div>
  );
}
