const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    channelId:   { type: String, required: true, index: true },
    channelName: { type: String, default: "" },
    type:        { type: String, enum: ["quiz_created", "quiz_started"], required: true },
    title:       { type: String, required: true },
    body:        { type: String, required: true },
    quizId:      { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
