const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema(
  {
    quizId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    title: { type: String, required: true, trim: true },
    owner: { type: String, required: true },
    ownerName: { type: String },
    channelId: { type: String, required: true, index: true },
    channelName: { type: String },
    isActive: { type: Boolean, default: false },
    timeLimit: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quiz", quizSchema);
