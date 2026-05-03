const mongoose = require("mongoose");

const ChannelKeySchema = new mongoose.Schema(
  {
    channelId: { type: String, required: true, unique: true, index: true },
    // AES-256 key stored as base64 (32 random bytes)
    key: { type: String, required: true, select: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChannelKey", ChannelKeySchema);
