const StreamChat = require("stream-chat").StreamChat;
require("dotenv").config();

const api_key = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;

const getAllUsers = async (_req, res) => {
  try {
    const client = StreamChat.getInstance(api_key, api_secret);

    console.log("[GET ALL USERS] Fetching users...");

    const { users } = await client.queryUsers(
      {},
      { created_at: -1 },
      { limit: 100 }
    );

    console.log(`[GET ALL USERS] Found ${users.length} users`);

    const userList = users.map((user) => ({
      id: user.id,
      username: user.name,
      fullName: user.fullName,
      role: user.role || "student",
      phoneNumber: user.phoneNumber,
      avatarURL: user.avatarURL,
      online: user.online,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    console.log(
      "[GET ALL USERS] User list with roles:",
      userList.map((u) => ({ id: u.id, role: u.role }))
    );

    res.status(200).json({ users: userList });
  } catch (error) {
    console.error("[GET ALL USERS ERROR]", error);
    res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    console.log(
      `[UPDATE ROLE] Attempting to update user ${userId} to role: ${role}`
    );

    const validRoles = ["admin", "teacher", "student"];
    if (!validRoles.includes(role)) {
      return res
        .status(400)
        .json({ message: "Invalid role. Must be admin, teacher, or student" });
    }

    const client = StreamChat.getInstance(api_key, api_secret);

    const { users } = await client.queryUsers({ id: userId });
    if (!users.length) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`[UPDATE ROLE] Current user data:`, users[0]);

    if (userId === req.user.id) {
      return res.status(403).json({ message: "Cannot change your own role" });
    }

    const updateResult = await client.upsertUser({
      id: userId,
      role: role,
    });

    // Invalidate tất cả JWT cũ của user khi role thay đổi
    const User = require("../models/User");
    await User.updateOne({ streamUserId: userId }, { $inc: { jwtVersion: 1 } });

    console.log(`[UPDATE ROLE] Update result:`, updateResult);

    // Verify update bằng cách query lại user
    const { users: updatedUsers } = await client.queryUsers({ id: userId });
    console.log(`[UPDATE ROLE] Updated user data:`, updatedUsers[0]);

    res.status(200).json({
      message: "User role updated successfully",
      userId: userId,
      newRole: role,
      updatedUser: {
        id: updatedUsers[0].id,
        role: updatedUsers[0].role,
        name: updatedUsers[0].name, // username cho định danh
        fullName: updatedUsers[0].fullName, // fullName cho hiển thị
      },
    });
  } catch (error) {
    console.error("[UPDATE ROLE ERROR]", error);
    res
      .status(500)
      .json({ message: "Error updating user role", error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const client = StreamChat.getInstance(api_key, api_secret);

    const { users } = await client.queryUsers({ id: userId });
    if (!users.length) {
      return res.status(404).json({ message: "User not found" });
    }

    if (userId === req.user.id) {
      return res
        .status(403)
        .json({ message: "Cannot delete your own account" });
    }

    await client.deleteUser(userId, {
      mark_messages_deleted: true,
      hard_delete: false,
    });

    res.status(200).json({
      message: "User deleted successfully",
      userId: userId,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error deleting user", error: error.message });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const client = StreamChat.getInstance(api_key, api_secret);

    const { users } = await client.queryUsers({ id: req.user.id });

    if (!users.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    res.status(200).json({
      id: user.id,
      username: user.name,
      fullName: user.fullName,
      role: user.role || "student",
      phoneNumber: user.phoneNumber,
      avatarURL: user.avatarURL,
      online: user.online,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error fetching user info", error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    console.log("[UPDATE PROFILE] Called with:", {
      userId: req.user.id,
      body: req.body,
    });

    const allowedFields = ["username", "fullName", "phoneNumber", "avatarURL"];
    const sanitizedBody = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        sanitizedBody[field] = req.body[field];
      }
    });

    console.log("[UPDATE PROFILE] Sanitized body:", sanitizedBody);
    console.log("[UPDATE PROFILE] Original body keys:", Object.keys(req.body));

    const { username, fullName, phoneNumber, avatarURL } = sanitizedBody;

    if (fullName !== undefined && !fullName.trim()) {
      console.log("[UPDATE PROFILE] Invalid fullName");
      return res.status(400).json({ message: "fullName cannot be empty" });
    }

    if (phoneNumber !== undefined && !phoneNumber.trim()) {
      console.log("[UPDATE PROFILE] Invalid phoneNumber");
      return res.status(400).json({ message: "phoneNumber cannot be empty" });
    }

    if (username !== undefined && !username.trim()) {
      console.log("[UPDATE PROFILE] Invalid username");
      return res.status(400).json({ message: "username cannot be empty" });
    }

    const forbiddenFields = Object.keys(req.body).filter(
      (key) => !allowedFields.includes(key)
    );
    if (forbiddenFields.length > 0) {
      console.log(
        "[UPDATE PROFILE] Forbidden fields detected:",
        forbiddenFields
      );
      return res.status(400).json({
        message: `Invalid fields: ${forbiddenFields.join(
          ", "
        )}. Only username, fullName, phoneNumber and avatarURL are allowed.`,
      });
    }

    if (phoneNumber !== undefined) {
      const phoneRegex = /^[0-9]{10,11}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({ message: "Invalid phone number format" });
      }
    }

    if (avatarURL !== undefined && avatarURL && avatarURL.trim()) {
      try {
        const u = new URL(avatarURL);
        if (u.protocol !== "https:") throw new Error();
      } catch {
        return res.status(400).json({ message: "avatarURL phải là HTTPS" });
      }
    }

    const client = StreamChat.getInstance(api_key, api_secret);

    const { users } = await client.queryUsers({ id: req.user.id });
    if (!users.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = users[0];

    console.log("[UPDATE PROFILE] Current user data:", {
      id: currentUser.id,
      name: currentUser.name,
      fullName: currentUser.fullName,
      role: currentUser.role,
      phoneNumber: currentUser.phoneNumber,
    });

    const updatedUserData = {
      id: req.user.id, // Sử dụng id làm định danh chính
    };
    updatedUserData.hashedPassword = currentUser.hashedPassword; // Giữ nguyên hashedPassword
    updatedUserData.role = currentUser.role; // Giữ nguyên role

    if (username !== undefined) {
      updatedUserData.name = username;
    }
    if (fullName !== undefined) {
      updatedUserData.fullName = fullName;
    }
    if (phoneNumber !== undefined) {
      updatedUserData.phoneNumber = phoneNumber;
    }
    if (avatarURL !== undefined) {
      updatedUserData.avatarURL = avatarURL;
    }

    console.log("[UPDATE PROFILE] Updated user data:", {
      id: updatedUserData.id,
      name: updatedUserData.name,
      fullName: updatedUserData.fullName,
      role: updatedUserData.role,
      phoneNumber: updatedUserData.phoneNumber,
    });

    await client.upsertUser(updatedUserData);

    console.log(`[UPDATE PROFILE] Updated profile for user ${req.user.id}`);

    const responseData = {};
    if (username !== undefined) responseData.username = username;
    if (fullName !== undefined) responseData.fullName = fullName;
    if (phoneNumber !== undefined) responseData.phoneNumber = phoneNumber;
    if (avatarURL !== undefined) responseData.avatarURL = avatarURL;

    res.status(200).json({
      message: "Profile updated successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("[UPDATE PROFILE ERROR]", error);
    res.status(500).json({
      message: "Error updating profile",
      error: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1. Validate các trường bắt buộc
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "currentPassword và newPassword là bắt buộc",
      });
    }

    // 2. Chặn các trường không hợp lệ
    const allowedFields = ["currentPassword", "newPassword"];
    const forbiddenFields = Object.keys(req.body).filter(
      (key) => !allowedFields.includes(key)
    );
    if (forbiddenFields.length > 0) {
      return res.status(400).json({
        message: `Trường không hợp lệ: ${forbiddenFields.join(", ")}`,
      });
    }

    // 3. Kiểm tra độ phức tạp mật khẩu mới
    const { validatePassword } = require("../utils/passwordValidator");
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      return res.status(400).json({ message: pwCheck.errors[0], errors: pwCheck.errors });
    }

    // 4. Lấy hashedPassword từ MongoDB (KHÔNG phải từ Stream)
    const bcrypt = require("bcrypt");
    const User = require("../models/User");

    const dbUser = await User.findOne({ streamUserId: req.user.id }).select("+hashedPassword");
    if (!dbUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    // 5. Xác minh mật khẩu hiện tại
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, dbUser.hashedPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
    }

    // 6. Kiểm tra mật khẩu mới không được trùng mật khẩu cũ
    const isSamePassword = await bcrypt.compare(newPassword, dbUser.hashedPassword);
    if (isSamePassword) {
      return res.status(400).json({ message: "Mật khẩu mới không được trùng với mật khẩu hiện tại" });
    }

    // 7. Hash mật khẩu mới, lưu vào MongoDB và invalidate token cũ
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await User.updateOne(
      { streamUserId: req.user.id },
      { hashedPassword: hashedNewPassword, $inc: { jwtVersion: 1 } }
    );

    res.status(200).json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("[CHANGE PASSWORD ERROR]", error.message);
    res.status(500).json({ message: "Lỗi máy chủ, vui lòng thử lại sau" });
  }
};

const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const client = StreamChat.getInstance(api_key, api_secret);

    const { users } = await client.queryUsers({ id: userId });
    if (!users.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    const isAdmin = req.user.role === "admin";
    res.status(200).json({
      id: user.id,
      username: user.name,
      fullName: user.fullName,
      role: user.role || "student",
      ...(isAdmin && { phoneNumber: user.phoneNumber }),
      avatarURL: user.avatarURL,
      online: user.online,
      ...(isAdmin && { hasPassword: !!user.hashedPassword }),
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  } catch (error) {
    console.error("[GET USER BY ID ERROR]", error);
    res.status(500).json({
      message: "Error fetching user details",
      error: error.message,
    });
  }
};

const updateUserByAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("[ADMIN UPDATE USER] Called with:", {
      adminId: req.user.id,
      targetUserId: userId,
      body: req.body,
    });

    const client = StreamChat.getInstance(api_key, api_secret);

    const { users } = await client.queryUsers({ id: userId });
    if (!users.length) {
      return res.status(404).json({ message: "Target user not found" });
    }

    const targetUser = users[0];

    const allowedFields = ["fullName", "phoneNumber", "avatarURL", "role"];
    const sanitizedBody = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        sanitizedBody[field] = req.body[field];
      }
    });

    console.log("[ADMIN UPDATE USER] Sanitized body:", sanitizedBody);

    const { fullName, phoneNumber, avatarURL, role } = sanitizedBody;

    if (role && !["admin", "teacher", "student"].includes(role)) {
      return res
        .status(400)
        .json({ message: "Invalid role. Must be admin, teacher, or student" });
    }

    if (phoneNumber && !/^[0-9]{10,11}$/.test(phoneNumber)) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    if (avatarURL && avatarURL.trim()) {
      try {
        const u = new URL(avatarURL);
        if (u.protocol !== "https:") throw new Error();
      } catch {
        return res.status(400).json({ message: "avatarURL phải là HTTPS" });
      }
    }

    const updatedUserData = {
      id: userId,
      name: targetUser.name,
      fullName: fullName !== undefined ? fullName : targetUser.fullName,
      phoneNumber:
        phoneNumber !== undefined ? phoneNumber : targetUser.phoneNumber,
      role: role !== undefined ? role : targetUser.role,
      hashedPassword: targetUser.hashedPassword,
      avatarURL: avatarURL !== undefined ? avatarURL : targetUser.avatarURL,
      ...(targetUser.created_at && { created_at: targetUser.created_at }),
    };

    console.log("[ADMIN UPDATE USER] Updated user data:", {
      ...updatedUserData,
      hashedPassword: updatedUserData.hashedPassword
        ? "[PRESERVED]"
        : "[MISSING]",
    });

    await client.upsertUser(updatedUserData);

    console.log(
      `[ADMIN UPDATE USER] Admin ${req.user.id} updated user ${userId}`
    );

    res.status(200).json({
      message: "User updated successfully by admin",
      data: {
        id: userId,
        fullName: updatedUserData.fullName,
        phoneNumber: updatedUserData.phoneNumber,
        avatarURL: updatedUserData.avatarURL,
        role: updatedUserData.role,
      },
    });
  } catch (error) {
    console.error("[ADMIN UPDATE USER ERROR]", error);
    res.status(500).json({
      message: "Error updating user",
      error: error.message,
    });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    // 1. Kiểm tra độ phức tạp mật khẩu mới
    const { validatePassword } = require("../utils/passwordValidator");
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      return res.status(400).json({ message: pwCheck.errors[0], errors: pwCheck.errors });
    }

    // 2. Kiểm tra target user tồn tại trên Stream
    const client = StreamChat.getInstance(api_key, api_secret);
    const { users } = await client.queryUsers({ id: userId });
    if (!users.length) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    // 3. Cập nhật hashedPassword trong MongoDB (KHÔNG lên Stream)
    const bcrypt = require("bcrypt");
    const User = require("../models/User");

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    const updated = await User.updateOne(
      { streamUserId: userId },
      { hashedPassword: hashedNewPassword, $inc: { jwtVersion: 1 } }
    );

    if (updated.matchedCount === 0) {
      return res.status(404).json({ message: "Không tìm thấy dữ liệu xác thực của người dùng" });
    }

    res.status(200).json({
      message: "Đặt lại mật khẩu thành công",
      userId: userId,
    });
  } catch (error) {
    console.error("[ADMIN RESET PASSWORD ERROR]", error.message);
    res.status(500).json({ message: "Lỗi máy chủ, vui lòng thử lại sau" });
  }
};

const verifyUserData = async (req, res) => {
  try {
    const client = StreamChat.getInstance(api_key, api_secret);
    const { users } = await client.queryUsers({ id: req.user.id });

    if (!users.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    res.status(200).json({
      message: "User data verification",
      data: {
        id: user.id,
        name: user.name,
        fullName: user.fullName,
        role: user.role,
        phoneNumber: user.phoneNumber,
        avatarURL: user.avatarURL,
        hasPassword: !!user.hashedPassword,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    console.error("[VERIFY USER ERROR]", error);
    res.status(500).json({
      message: "Error verifying user data",
      error: error.message,
    });
  }
};

module.exports = {
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
};