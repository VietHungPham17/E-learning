const mongoose = require("mongoose");

const quizSessionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    quizId: { type: String, required: true, index: true },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    submitted: { type: Boolean, default: false },
    questionOrder: [Number],
    tabSwitches: { type: Number, default: 0 },
  },
  { timestamps: true }
);

quizSessionSchema.index({ quizId: 1, userId: 1, submitted: 1 });

module.exports = mongoose.model("QuizSession", quizSessionSchema);
