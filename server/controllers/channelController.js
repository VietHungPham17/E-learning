const crypto     = require("crypto");
const StreamChat = require("stream-chat").StreamChat;
require("dotenv").config();

const api_key    = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;

// POST /api/channels
// Tạo channel bằng admin credentials của server để tránh lỗi phân quyền từ Stream.
const createChannel = async (req, res) => {
  try {
    const { type, name, members } = req.body;

    if (!["team", "messaging"].includes(type)) {
      return res.status(400).json({ message: "Loại kênh không hợp lệ" });
    }

    if (!Array.isArray(members) || members.length < 1) {
      return res.status(400).json({ message: "Cần ít nhất 1 thành viên" });
    }

    if (type === "team" && (!name || !name.trim())) {
      return res.status(400).json({ message: "Tên kênh không được để trống" });
    }

    if (type === "team" && !["admin", "teacher"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Chỉ Admin và Teacher mới có thể tạo Channel nhóm" });
    }

    const client = StreamChat.getInstance(api_key, api_secret);

    // Deduplicate + đảm bảo người tạo nằm trong danh sách thành viên
    const memberIds = [
      ...new Set(
        [req.user.id, ...members].filter((id) => id && typeof id === "string")
      ),
    ];

    let channel;

    if (type === "team") {
      // Dùng UUID ngắn làm channel ID để tránh xung đột tên
      const channelId = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
      channel = client.channel("team", channelId, {
        name: name.trim(),
        created_by_id: req.user.id,
        members: memberIds,
      });
    } else {
      // messaging: Stream tự sinh ID từ danh sách members khi không truyền channelId
      channel = client.channel("messaging", {
        members: memberIds,
        created_by_id: req.user.id,
      });
    }

    const result = await channel.create();

    return res.status(200).json({
      id:   result.channel.id,
      type: result.channel.type,
      name: result.channel.name || name || "",
    });
  } catch (error) {
    console.error("[CREATE CHANNEL ERROR]", error);
    return res.status(500).json({
      message: error.message || "Lỗi tạo kênh, vui lòng thử lại",
    });
  }
};

module.exports = { createChannel };
