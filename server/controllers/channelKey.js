const crypto     = require("crypto");
const ChannelKey = require("../models/ChannelKey");
const StreamChat = require("stream-chat").StreamChat;
require("dotenv").config();

const api_key    = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;

// Derive 32-byte encryption key từ JWT_SECRET bằng SHA-256
function getMasterKey() {
  return crypto.createHash("sha256").update(process.env.JWT_SECRET || "fallback").digest();
}

// Encrypt AES key bằng AES-256-GCM trước khi lưu DB
function encryptChannelKey(plainBase64) {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getMasterKey(), iv);
  const enc    = Buffer.concat([cipher.update(plainBase64, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${iv.toString("hex")}:${enc.toString("hex")}:${tag.toString("hex")}`;
}

// Decrypt — fallback sang plaintext nếu key cũ chưa được mã hóa
function decryptChannelKey(stored) {
  const parts = stored.split(":");
  if (parts.length !== 3) return stored; // legacy plaintext
  const [ivHex, encHex, tagHex] = parts;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", getMasterKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(encHex, "hex")).toString("utf8") + decipher.final("utf8");
  } catch {
    return stored; // fallback nếu decrypt thất bại
  }
}

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

    // Get or create AES key (stored encrypted)
    let record = await ChannelKey.findOne({ channelId });
    if (!record) {
      const plainKey = crypto.randomBytes(32).toString("base64");
      record = await ChannelKey.create({ channelId, key: encryptChannelKey(plainKey) });
      return res.status(200).json({ key: plainKey });
    }

    return res.status(200).json({ key: decryptChannelKey(record.key) });
  } catch (error) {
    console.error("[CHANNEL KEY ERROR]", error);
    return res.status(500).json({ message: "Lỗi lấy key channel" });
  }
};

module.exports = { getChannelKey };
