import React, { useState, useEffect } from "react";
import { useChatContext } from "stream-chat-react";
import Cookies from "universal-cookie";
import apiClient from "../services/apiClient";
import "./AdminChannelManager.css";

const cookies = new Cookies();

const AdminChannelManager = ({ activeAdminTab, isCollapsed }) => {
  const { client } = useChatContext();
  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]);
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
  const [activeTab, setActiveTab] = useState("info");

  const userId = cookies.get("userId");

  useEffect(() => {
    fetchUsers();
    fetchChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/api/users");
      setUsers(response.data.users);
      setError(null);
    } catch (err) {
      console.error("[CLIENT] Error fetching users:", err);
      setError(err.response?.data?.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const filter = {};
      const sort = { last_message_at: -1 };
      const channels = await client.queryChannels(filter, sort, {
        watch: true,
        state: true,
      });
      setChannels(channels);
    } catch (err) {
      console.error("Error fetching channels:", err);
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
    setActiveTab("info"); // Reset to info tab when selecting a new user
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
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      await apiClient.delete(`/api/users/${targetUserId}`);

      await fetchUsers();
      alert("User deleted successfully!");
    } catch (err) {
      console.error("Error deleting user:", err);
      alert(err.response?.data?.message || "Failed to delete user");
    }
  };

  const handleDeleteChannel = async (channel) => {
    if (
      !window.confirm(
        `Are you sure you want to delete channel "${
          channel.data.name || channel.data.id
        }"?`,
      )
    ) {
      return;
    }

    try {
      await channel.delete();
      await fetchChannels();
      alert("Channel deleted successfully!");
    } catch (err) {
      console.error("Error deleting channel:", err);
      alert("Failed to delete channel");
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

  const getChannelType = (channel) => {
    return channel.type === "team" ? "Team Channel" : "Direct Message";
  };

  const renderUserDetails = () => {
    return (
      <div className="user-details-panel">
        <div className="user-header">
          <div className="user-avatar-section">
            <img
              src={
                selectedUserDetails.avatarURL ||
                `https://getstream.io/random_png/?id=${selectedUserDetails.id}&name=${selectedUserDetails.fullName}`
              }
              alt={selectedUserDetails.fullName}
              className="user-avatar-large"
            />
            <div className="user-basic-info">
              <h2>{selectedUserDetails.fullName}</h2>
              <p className="user-email">{selectedUserDetails.id}</p>
              <span
                className={`user-role-badge role-${selectedUserDetails.role}`}
              >
                {selectedUserDetails.role}
              </span>
            </div>
          </div>
          <button
            className="close-details-btn"
            onClick={() => {
              setSelectedUserDetails(null);
              setSelectedUser(null);
              setEditMode(false);
              setActiveTab("info");
            }}
          >
            ✕
          </button>
        </div>

        {message && <div className={`message ${messageType}`}>{message}</div>}

        <div className="details-tabs">
          <button
            className={`tab-btn ${activeTab === "info" ? "active" : ""}`}
            onClick={() => setActiveTab("info")}
          >
            📋 Thông tin
          </button>
          <button
            className={`tab-btn ${activeTab === "security" ? "active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            🔒 Bảo mật
          </button>
        </div>

        <div className="tab-content">
          {activeTab === "info" && (
            <div className="info-tab">
              <div className="form-actions">
                {!editMode ? (
                  <button
                    className="edit-btn"
                    onClick={() => setEditMode(true)}
                  >
                    ✏️ Chỉnh sửa thông tin
                  </button>
                ) : (
                  <div className="edit-actions">
                    <button className="save-btn" onClick={handleUpdateUser}>
                      💾 Lưu thay đổi
                    </button>
                    <button
                      className="cancel-btn"
                      onClick={() => {
                        setEditMode(false);
                        setFormData({
                          fullName: selectedUserDetails.fullName || "",
                          phoneNumber: selectedUserDetails.phoneNumber || "",
                          avatarURL: selectedUserDetails.avatarURL || "",
                          role: selectedUserDetails.role || "student",
                        });
                        setMessage("");
                        setMessageType("");
                      }}
                    >
                      ❌ Hủy
                    </button>
                  </div>
                )}
              </div>

              <div className="user-info-grid">
                <div className="info-group">
                  <label>UserName:</label>
                  <span>{selectedUserDetails.username}</span>
                </div>

                {/* <div className="info-group">
                  <label>UserName(Debug):</label>
                  {editMode ? (
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      className="edit-input"
                    />
                  ) : (
                    <span>
                      {selectedUserDetails.username || "Chưa cập nhật"}
                    </span>
                  )}
                </div> */}

                <div className="info-group">
                  <label>Tên đầy đủ:</label>
                  {editMode ? (
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="edit-input"
                    />
                  ) : (
                    <span>{selectedUserDetails.fullName}</span>
                  )}
                </div>

                <div className="info-group">
                  <label>Email:</label>
                  <span>
                    {selectedUserDetails.email || "Chưa Liên kết Email"}
                  </span>
                </div>

                <div className="info-group">
                  <label>Số điện thoại:</label>
                  {editMode ? (
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      className="edit-input"
                    />
                  ) : (
                    <span>
                      {selectedUserDetails.phoneNumber || "Chưa cập nhật"}
                    </span>
                  )}
                </div>

                <div className="info-group">
                  <label>Vai trò:</label>
                  {editMode ? (
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="edit-select"
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span
                      className={`role-text role-${selectedUserDetails.role}`}
                    >
                      {selectedUserDetails.role.charAt(0).toUpperCase() +
                        selectedUserDetails.role.slice(1)}
                    </span>
                  )}
                </div>

                <div className="info-group">
                  <label>Ảnh đại diện URL:</label>
                  {editMode ? (
                    <input
                      type="url"
                      name="avatarURL"
                      value={formData.avatarURL}
                      onChange={handleInputChange}
                      className="edit-input"
                      placeholder="https://example.com/avatar.jpg"
                    />
                  ) : (
                    <span>
                      {selectedUserDetails.avatarURL || "Ảnh mặc định"}
                    </span>
                  )}
                </div>

                <div className="info-group">
                  <label>Trạng thái:</label>
                  <span
                    className={`status-display ${
                      selectedUserDetails.online ? "online" : "offline"
                    }`}
                  >
                    {selectedUserDetails.online
                      ? "🟢 Trực tuyến"
                      : "🔴 Ngoại tuyến"}
                  </span>
                </div>

                <div className="info-group">
                  <label>Ngày tham gia:</label>
                  <span>
                    {new Date(
                      selectedUserDetails.created_at,
                    ).toLocaleDateString("vi-VN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="info-group">
                  <label>Lần cuối hoạt động:</label>
                  <span>
                    {selectedUserDetails.last_active
                      ? new Date(
                          selectedUserDetails.last_active,
                        ).toLocaleDateString("vi-VN", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Chưa xác định"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="security-tab">
              <div className="security-section">
                <h3>🔐 Đặt lại mật khẩu</h3>
                <p className="security-note">
                  Với quyền Admin, bạn có thể đặt lại mật khẩu cho người dùng
                  này.
                </p>

                <div className="password-form">
                  <div className="input-group">
                    <label htmlFor="newPassword">Mật khẩu mới:</label>
                    <input
                      type="password"
                      id="newPassword"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className="password-input"
                      placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="confirmPassword">Xác nhận mật khẩu:</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      className="password-input"
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  </div>

                  <button
                    className="reset-password-btn"
                    onClick={handleResetPassword}
                    disabled={
                      !passwordData.newPassword || !passwordData.confirmPassword
                    }
                  >
                    🔄 Đặt lại mật khẩu
                  </button>
                </div>
              </div>

              <div className="security-info">
                <h4>📋 Thông tin bảo mật</h4>
                <div className="security-details">
                  <div className="security-item">
                    <span className="security-label">ID người dùng:</span>
                    <span className="security-value">
                      {selectedUserDetails.id}
                    </span>
                  </div>
                  <div className="security-item">
                    <span className="security-label">Cấp độ quyền:</span>
                    <span
                      className={`security-value role-${selectedUserDetails.role}`}
                    >
                      {selectedUserDetails.role}
                    </span>
                  </div>
                  <div className="security-item">
                    <span className="security-label">
                      Trạng thái tài khoản:
                    </span>
                    <span className="security-value status-active">
                      ✅ Đang hoạt động
                    </span>
                  </div>
                </div>
              </div>

              <div className="danger-zone">
                <p className="danger-note">
                  Xóa người dùng này sẽ xóa vĩnh viễn tài khoản và tất cả dữ
                  liệu liên quan. Hành động này không thể hoàn tác.
                </p>
                <button
                  className="delete-user-btn"
                  onClick={() => handleDeleteUser(selectedUserDetails.id)}
                >
                  Delete User
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`admin-manager-container ${isCollapsed ? "collapsed" : ""}`}
    >
      <div className="admin-manager-header">
        <h2>Admin Management Panel</h2>
        <div className="admin-tabs">
          <div
            className={`tab-indicator ${
              activeAdminTab === "users" ? "active" : ""
            }`}
          >
            👥 Users Management
          </div>
          <div
            className={`tab-indicator ${
              activeAdminTab === "channels" ? "active" : ""
            }`}
          >
            💬 Channels Management
          </div>
        </div>
      </div>

      {loading && <div className="loading">Loading...</div>}

      {error && <div className="error-message">{error}</div>}

      {!loading && !error && (
        <div className="admin-manager-content">
          {activeAdminTab === "users" && (
            <div className="users-section">
              {/* <div className="users-stats">
                <div className="stat-card">
                  <h3>Total Users</h3>
                  <p>{users.length}</p>
                </div>
                <div className="stat-card">
                  <h3>Admins</h3>
                  <p>{users.filter((u) => u.role === "admin").length}</p>
                </div>
                <div className="stat-card">
                  <h3>Teachers</h3>
                  <p>{users.filter((u) => u.role === "teacher").length}</p>
                </div>
                <div className="stat-card">
                  <h3>Students</h3>
                  <p>{users.filter((u) => u.role === "student").length}</p>
                </div>
              </div> */}

              <div className="admin-content-container">
                {/* Users List */}
                <div className="users-list-section">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Full Name</th>
                        <th>Role</th>
                        <th>Phone</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr
                          key={user.id}
                          className={`${
                            user.id === userId ? "current-user" : ""
                          } ${selectedUser === user.id ? "selected" : ""}`}
                          onClick={() => handleUserSelect(user)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>{user.username}</td>
                          <td>{user.fullName}</td>
                          <td>
                            <span
                              className={`role-badge ${getRoleBadgeClass(
                                user.role,
                              )}`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td>{user.phoneNumber || "N/A"}</td>
                          <td>
                            <span
                              className={`status-badge ${
                                user.online ? "online" : "offline"
                              }`}
                            >
                              {user.online ? "Online" : "Offline"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* User Details Panel */}
                {selectedUserDetails && (
                  <div className="user-details-section">
                    {renderUserDetails()}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeAdminTab === "channels" && (
            <div className="channels-section">
              {/* <div className="channels-stats">
                <div className="stat-card">
                  <h3>Total Channels</h3>
                  <p>{channels.length}</p>
                </div>
                <div className="stat-card">
                  <h3>Team Channels</h3>
                  <p>{channels.filter((c) => c.type === "team").length}</p>
                </div>
                <div className="stat-card">
                  <h3>Direct Messages</h3>
                  <p>{channels.filter((c) => c.type === "messaging").length}</p>
                </div>
                <div className="stat-card">
                  <h3>Active Members</h3>
                  <p>
                    {channels.reduce(
                      (sum, c) =>
                        sum +
                        (c.state.members
                          ? Object.keys(c.state.members).length
                          : 0),
                      0
                    )}
                  </p>
                </div>
              </div> */}

              <div className="channels-grid">
                {channels.map((channel) => (
                  <div key={channel.id} className="channel-card">
                    <div className="channel-card-header">
                      <h4>{channel.data.name || channel.data.id}</h4>
                      <span className={`channel-type ${channel.type}`}>
                        {getChannelType(channel)}
                      </span>
                    </div>
                    <div className="channel-card-body">
                      <p>
                        <strong>ID:</strong> {channel.id}
                      </p>
                      <p>
                        <strong>Created:</strong>{" "}
                        {new Date(channel.data.created_at).toLocaleDateString()}
                      </p>
                      <p>
                        <strong>Members:</strong>{" "}
                        {channel.state.members
                          ? Object.keys(channel.state.members).length
                          : 0}
                      </p>
                      <p>
                        <strong>Messages:</strong>{" "}
                        {channel.state.messages?.length || 0}
                      </p>
                    </div>
                    <div className="channel-card-footer">
                      <button
                        className="delete-channel-button"
                        onClick={() => handleDeleteChannel(channel)}
                      >
                        Delete Channel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminChannelManager;
