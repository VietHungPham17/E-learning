const crypto = require("crypto");
const ChannelKey = require("../models/ChannelKey");
const StreamChat = require("stream-chat").StreamChat;
require("dotenv").config();

const api_key    = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;

// POST /api/channel-key  (body: { channelId })
// Returns the AES-256 key for a channel, creating one if it doesn't exist.
// Only members of the channel can fetch its key.
const getChannelKey = async (req, res) => {
  try {
    const { channelId } = req.body;
    if (!channelId || typeof channelId !== "string" || channelId.trim() === "") {
      return res.status(400).json({ message: "channelId là bắt buộc" });
    }

    const [type, ...idParts] = channelId.split(":");
    const id = idParts.join(":");

    if (!type || !id) {
      return res.status(400).json({ message: "channelId không hợp lệ" });
    }

    // Use server credentials to fetch channel state (includes full member list)
    const client = StreamChat.getInstance(api_key, api_secret);

    const channels = await client.queryChannels(
      { type, id },
      {},
      { limit: 1, state: true, watch: false }
    );

    if (!channels.length) {
      return res.status(404).json({ message: "Channel không tồn tại" });
    }

    // state.members is keyed by user ID
    const isMember = channels[0].state?.members?.[req.user.id] !== undefined;
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không phải thành viên của channel này" });
    }

    // Get or create AES key
    let record = await ChannelKey.findOne({ channelId });
    if (!record) {
      const key = crypto.randomBytes(32).toString("base64");
      record = await ChannelKey.create({ channelId, key });
    }

    return res.status(200).json({ key: record.key });
  } catch (error) {
    console.error("[CHANNEL KEY ERROR]", error);
    return res.status(500).json({ message: "Lỗi lấy key channel" });
  }
};

module.exports = { getChannelKey };