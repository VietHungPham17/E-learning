const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    correct: { type: Boolean, default: false },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    quizId: { type: String, required: true, index: true },
    question: { type: String, required: true },
    answers: {
      type: [answerSchema],
      validate: (v) => v.length === 4,
    },
    createdBy: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);
