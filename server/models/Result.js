const mongoose = require("mongoose");

const answerDetailSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    your: { type: Number, required: true },
    correct: { type: Number, required: true },
    ok: { type: Boolean, required: true },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String },
    quizId: { type: String, required: true, index: true },
    quizTitle: { type: String },

    attempt: { type: Number, required: true },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    timeUsed: { type: Number },
    tabSwitches: { type: Number, default: 0 },

    answers: [answerDetailSchema],
  },
  { timestamps: true }
);

resultSchema.index({ quizId: 1, userId: 1, attempt: -1 });

module.exports = mongoose.model("Result", resultSchema);
