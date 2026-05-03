import React, { useState, useEffect } from "react";
import Cookies from "universal-cookie";
import apiClient from "../services/apiClient";
import "./AdminPanel.css";

const cookies = new Cookies();

const AdminPanel = ({ onClose }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    avatarURL: "",
    role: "",
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const userId = cookies.get("userId");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/api/users");
      setUsers(response.data.users);
      setError(null);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err.response?.data?.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (targetUserId) => {
    try {
      const response = await apiClient.get(`/api/users/${targetUserId}`);

      const userDetails = response.data;
      setSelectedUserDetails(userDetails);
      setFormData({
        fullName: userDetails.fullName || "",
        phoneNumber: userDetails.phoneNumber || "",
        avatarURL: userDetails.avatarURL || "",
        role: userDetails.role || "student",
      });
      setEditMode(false);
      setMessage("");
      setMessageType("");
    } catch (err) {
      console.error("Error fetching user details:", err);
      setMessage(err.response?.data?.message || "Failed to fetch user details");
      setMessageType("error");
    }
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user.id);
    fetchUserDetails(user.id);
  };

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

  const handleUpdateUser = async () => {
    try {
      await apiClient.put(`/api/users/${selectedUser}`, formData);

      setMessage("✅ Cập nhật thông tin người dùng thành công!");
      setMessageType("success");
      setEditMode(false);

      await fetchUserDetails(selectedUser);
      await fetchUsers();

      setTimeout(() => {
        setMessage("");
        setMessageType("");
      }, 3000);
    } catch (err) {
      console.error("Error updating user:", err);
      setMessage(err.response?.data?.message || "Failed to update user");
      setMessageType("error");
    }
  };

  const handleResetPassword = async () => {
    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      setMessage("Mật khẩu mới phải có ít nhất 6 ký tự");
      setMessageType("error");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage("Mật khẩu xác nhận không khớp");
      setMessageType("error");
      return;
    }

    if (
      !window.confirm(
        "Bạn có chắc chắn muốn đặt lại mật khẩu cho người dùng này?",
      )
    ) {
      return;
    }

    try {
      await apiClient.put(
        `/api/users/${selectedUser}/reset-password`,
        { newPassword: passwordData.newPassword },
      );

      setMessage("🔒 Đặt lại mật khẩu thành công!");
      setMessageType("success");
      setPasswordData({ newPassword: "", confirmPassword: "" });

      setTimeout(() => {
        setMessage("");
        setMessageType("");
      }, 3000);
    } catch (err) {
      console.error("Error resetting password:", err);
      setMessage(err.response?.data?.message || "Failed to reset password");
      setMessageType("error");
    }
  };

  const handleDeleteUser = async (targetUserId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa người dùng này?")) {
      return;
    }

    try {
      await apiClient.delete(`/api/users/${targetUserId}`);

      setMessage("✅ Xóa người dùng thành công!");
      setMessageType("success");
      setSelectedUser(null);
      setSelectedUserDetails(null);

      await fetchUsers();

      setTimeout(() => {
        setMessage("");
        setMessageType("");
      }, 3000);
    } catch (err) {
      console.error("Error deleting user:", err);
      setMessage(err.response?.data?.message || "Failed to delete user");
      setMessageType("error");
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case "admin":
        return "badge-admin";
      case "teacher":
        return "badge-teacher";
      case "student":
        return "badge-student";
      default:
        return "badge-default";
    }
  };

  const renderUserDetails = () => {
    if (!selectedUserDetails) {
      return (
        <div className="user-details-placeholder">
          <h3>Chọn người dùng để xem thông tin chi tiết</h3>
          <p>
            Nhấp vào một người dùng trong danh sách để xem và chỉnh sửa thông
            tin của họ
          </p>
        </div>
      );
    }

    return (
      <div className="user-details-container">
        <div className="user-details-header">
          <div className="user-avatar">
            {selectedUserDetails.avatarURL ? (
              <img
                src={selectedUserDetails.avatarURL}
                alt="Avatar"
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "flex";
                }}
              />
            ) : null}
            <span
              style={{
                display: selectedUserDetails.avatarURL ? "none" : "flex",
              }}
            >
              {selectedUserDetails.fullName?.[0]?.toUpperCase() ||
                selectedUserDetails.username?.[0]?.toUpperCase() ||
                "U"}
            </span>
          </div>
          <div className="user-info">
            <h3>
              {selectedUserDetails.fullName || selectedUserDetails.username}
            </h3>
            <p>@{selectedUserDetails.username}</p>
            <span
              className={`role-badge ${getRoleBadgeClass(
                selectedUserDetails.role,
              )}`}
            >
              {selectedUserDetails.role}
            </span>
          </div>
        </div>

        <div className="user-details-tabs">
          <button
            className={`tab-button ${!editMode ? "active" : ""}`}
            onClick={() => setEditMode(false)}
          >
            Thông tin
          </button>
          <button
            className={`tab-button ${editMode ? "active" : ""}`}
            onClick={() => setEditMode(true)}
          >
            Chỉnh sửa
          </button>
        </div>

        {!editMode ? renderUserInfo() : renderUserEdit()}

        {message && <div className={`message ${messageType}`}>{message}</div>}
      </div>
    );
  };

  const renderUserInfo = () => (
    <div className="user-info-view">
      <div className="info-section">
        <h4>Thông tin cá nhân</h4>
        <div className="info-grid">
          <div className="info-item">
            <label>Username (ID đăng nhập)</label>
            <span>{selectedUserDetails.username}</span>
          </div>
          <div className="info-item">
            <label>Họ và tên</label>
            <span>{selectedUserDetails.fullName || "Chưa cập nhật"}</span>
          </div>
          <div className="info-item">
            <label>Số điện thoại</label>
            <span>{selectedUserDetails.phoneNumber || "Chưa cập nhật"}</span>
          </div>
          <div className="info-item">
            <label>Vai trò</label>
            <span
              className={`role-badge ${getRoleBadgeClass(
                selectedUserDetails.role,
              )}`}
            >
              {selectedUserDetails.role === "admin"
                ? "Quản trị viên"
                : selectedUserDetails.role === "teacher"
                  ? "Giáo viên"
                  : "Học sinh"}
            </span>
          </div>
          <div className="info-item">
            <label>Avatar URL</label>
            <span>
              {selectedUserDetails.avatarURL || "Sử dụng avatar mặc định"}
            </span>
          </div>
          <div className="info-item">
            <label>Trạng thái</label>
            <span
              className={`status-badge ${
                selectedUserDetails.online ? "online" : "offline"
              }`}
            >
              {selectedUserDetails.online ? "Đang online" : "Offline"}
            </span>
          </div>
          <div className="info-item">
            <label>Có mật khẩu</label>
            <span
              className={
                selectedUserDetails.hasPassword ? "text-success" : "text-danger"
              }
            >
              {selectedUserDetails.hasPassword ? "✓ Có" : "✗ Không"}
            </span>
          </div>
        </div>
      </div>

      {selectedUser !== userId && (
        <div className="danger-zone">
          <h4>Vùng nguy hiểm</h4>
          <button
            className="delete-button-large"
            onClick={() => handleDeleteUser(selectedUser)}
          >
            Xóa người dùng này
          </button>
        </div>
      )}
    </div>
  );

  const renderUserEdit = () => (
    <div className="user-edit-view">
      <div className="edit-section">
        <h4>Chỉnh sửa thông tin</h4>

        <div className="form-group">
          <label>Username (không thể thay đổi)</label>
          <input
            type="text"
            value={selectedUserDetails.username}
            disabled
            className="disabled"
          />
        </div>

        <div className="form-group">
          <label>Họ và tên</label>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            placeholder="Nhập họ và tên"
          />
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
            placeholder="Nhập đường link ảnh đại diện"
          />
        </div>

        <div className="form-group">
          <label>Vai trò</label>
          <select
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            disabled={selectedUser === userId}
          >
            <option value="student">Học sinh</option>
            <option value="teacher">Giáo viên</option>
            <option value="admin">Quản trị viên</option>
          </select>
          {selectedUser === userId && (
            <small>Bạn không thể thay đổi vai trò của chính mình</small>
          )}
        </div>

        <div className="form-actions">
          <button onClick={handleUpdateUser} className="save-button">
            Lưu thay đổi
          </button>
        </div>
      </div>

      <div className="password-section">
        <h4>Đặt lại mật khẩu</h4>

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
          <button onClick={handleResetPassword} className="reset-button">
            Đặt lại mật khẩu
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-panel-overlay">
      <div className="admin-panel-container">
        <div className="admin-panel-header">
          <h2>Quản lý người dùng</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="admin-panel-content">
          <div className="users-list-section">
            <div className="users-stats">
              <div className="stat-card">
                <h3>Tổng số</h3>
                <p>{users.length}</p>
              </div>
              <div className="stat-card">
                <h3>Admin</h3>
                <p>{users.filter((u) => u.role === "admin").length}</p>
              </div>
              <div className="stat-card">
                <h3>Teacher</h3>
                <p>{users.filter((u) => u.role === "teacher").length}</p>
              </div>
              <div className="stat-card">
                <h3>Student</h3>
                <p>{users.filter((u) => u.role === "student").length}</p>
              </div>
            </div>

            {loading && <div className="loading">Đang tải danh sách...</div>}
            {error && <div className="error-message">{error}</div>}

            {!loading && !error && (
              <div className="users-list">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={`user-item ${
                      selectedUser === user.id ? "selected" : ""
                    } ${user.id === userId ? "current-user" : ""}`}
                    onClick={() => handleUserSelect(user)}
                  >
                    <div className="user-item-avatar">
                      {user.avatarURL ? (
                        <img src={user.avatarURL} alt="Avatar" />
                      ) : (
                        <span>
                          {user.fullName?.[0]?.toUpperCase() ||
                            user.username?.[0]?.toUpperCase() ||
                            "U"}
                        </span>
                      )}
                    </div>
                    <div className="user-item-info">
                      <h4>{user.fullName || user.username}</h4>
                      <p>@{user.username}</p>
                      <span
                        className={`role-badge ${getRoleBadgeClass(user.role)}`}
                      >
                        {user.role}
                      </span>
                    </div>
                    <div className="user-item-status">
                      <span
                        className={`status-dot ${
                          user.online ? "online" : "offline"
                        }`}
                      ></span>
                    </div>
                    {user.id === userId && <div className="you-label">Bạn</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="user-details-section">{renderUserDetails()}</div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
