const { Types } = require("mongoose");
const Quiz = require("../models/Quiz");
const Question = require("../models/Question");
const Result = require("../models/Result");
const QuizSession = require("../models/QuizSession");
const Notification = require("../models/Notification");
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function emitQuizNotification(req, { channelId, channelName, type, title, body, quizId }) {
  const notif = await Notification.create({ channelId, channelName, type, title, body, quizId });
  if (req.io) {
    req.io.to(`quiz-channel:${channelId}`).emit("quiz-notification", notif.toObject());
  }
}

const isValidObjectId = (id) => Types.ObjectId.isValid(id) && String(new Types.ObjectId(id)) === id;

// ============ AI QUIZ GENERATION ============

const generateQuizWithAI = async (req, res) => {
  try {
    let { topics, questionCount, difficulty } = req.body;

    // --- Validate topics ---
    if (!topics) {
      return res.status(400).json({ message: "Topics is required" });
    }

    // Normalize topics to array
    if (typeof topics === "string") {
      if (["all", "All", "ALL"].includes(topics)) {
        topics = ["All"];
      } else if (["random", "Random"].includes(topics)) {
        topics = ["Random"];
      } else {
        topics = [topics];
      }
    }

    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({
        message: "Topics must be an array or valid string ('All' / 'Random')",
      });
    }

    // --- Validate question count ---
    if (!questionCount || questionCount < 1 || questionCount > 50) {
      return res.status(400).json({
        message: "Question count must be between 1 and 50",
      });
    }

    // --- Validate difficulty ---
    if (!difficulty) {
      return res.status(400).json({
        message: "Difficulty is required",
      });
    }

    // --- Check API Key ---
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        message: "Gemini API key missing",
      });
    }

    console.log(
      `[GEMINI] Requesting ${questionCount} questions | Topics: ${topics.join(", ")}, Difficulty: ${difficulty}`
    );

    // --- Prompt ---
    const prompt = `
You are a quiz generator. Return ONLY a pure JSON array—no markdown, no comments.

Create exactly ${questionCount} multiple-choice questions on topics: ${topics.join(", ")}.
Difficulty: ${difficulty}

Each item format:
{
 "questionText": "string",
 "options": ["A", "B", "C", "D"],
 "correctAnswer": "A",
 "explanation": "string"
}

Return JSON array only:
`;

    // --- Call Gemini ---
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let responseObj;
    try {
      const result = await model.generateContent(prompt);
      responseObj = result.response;
    } catch (err) {
      console.error("[GEMINI SDK ERROR]", err);
      return res.status(500).json({
        message: "Error calling Gemini API",
        error: err.message,
      });
    }

    if (!responseObj || !responseObj.text) {
      return res.status(500).json({
        message: "Gemini returned invalid response",
        raw: responseObj,
      });
    }

    let rawText = responseObj.text().trim();

    // --- Clean markdown if any ---
    rawText = rawText.replace(/```json|```/g, "").trim();

    // --- Try to parse raw JSON first ---
    let questions;
    try {
      questions = JSON.parse(rawText);
    } catch {
      // fallback: extract array between first '[' and last ']'
      const start = rawText.indexOf("[");
      const end = rawText.lastIndexOf("]") + 1;
      const extracted = rawText.substring(start, end);

      try {
        questions = JSON.parse(extracted);
      } catch (err2) {
        return res.status(500).json({
          message: "Invalid JSON returned by Gemini",
          rawResponse: rawText.substring(0, 500),
          error: err2.message,
        });
      }
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(500).json({
        message: "Gemini did not return valid question array",
      });
    }

    // --- Final validation, cleanup, normalize ---
    const formattedQuestions = [];
    for (const q of questions) {
      if (!q.questionText || !Array.isArray(q.options) || q.options.length !== 4)
        continue;

      // Normalize correctAnswer
      let correct = (q.correctAnswer || "").toString().toUpperCase();
      correct = correct.replace(/[^A-D]/g, ""); // remove unwanted chars

      if (!["A", "B", "C", "D"].includes(correct)) continue;

      // Remove duplicate options
      const uniqueOptions = [...new Set(q.options.map((o) => o.trim()))];
      if (uniqueOptions.length !== 4) continue;

      formattedQuestions.push({
        questionText: q.questionText.trim(),
        options: uniqueOptions,
        correctAnswer: correct,
        explanation: q.explanation
          ? q.explanation.toString().trim()
          : "No explanation provided",
      });

      if (formattedQuestions.length === questionCount) break; // ensure exact count
    }

    if (formattedQuestions.length === 0) {
      return res.status(500).json({
        message: "No valid questions could be parsed",
      });
    }

    // Suggested title
    const topicLabel =
      topics.length <= 3 ? topics.join(", ") : `${topics.slice(0, 3).join(", ")}...`;

    res.status(200).json({
      suggestedTitle: `AI Quiz: ${topicLabel} (${difficulty})`,
      questions: formattedQuestions,
      metadata: {
        topics,
        difficulty,
        questionCount: formattedQuestions.length,
        requestedCount: questionCount,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[GENERATE QUIZ ERROR]", error);
    res.status(500).json({
      message: "Unexpected server error",
      error: error.message,
    });
  }
};


// Save AI-generated quiz to database
const saveGeneratedQuiz = async (req, res) => {
  try {
    const { quizId, title, timeLimit, channelId, channelName, questions } =
      req.body;

    if (!quizId || !title || !channelId) {
      return res.status(400).json({
        message: "quizId, title, and channelId are required",
      });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: "Questions array cannot be empty",
      });
    }

    const exists = await Quiz.findOne({ quizId });
    if (exists) {
      return res.status(400).json({
        message: "Quiz ID already exists",
      });
    }

    const quiz = await Quiz.create({
      quizId,
      title,
      owner: req.user.id,
      ownerName: req.user.fullName || req.user.name,
      channelId,
      channelName: channelName || "Unknown",
      timeLimit: timeLimit || 0,
      isActive: false,
    });

    const createdQuestions = [];
    const failedQuestions = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      try {
        if (
          !q.questionText ||
          !Array.isArray(q.options) ||
          q.options.length !== 4
        ) {
          failedQuestions.push({ index: i, reason: "Invalid format" });
          continue;
        }

        // Normalize correct answer
        let correct = q.correctAnswer?.toString().toUpperCase() || "";
        correct = correct.replace(/[^A-D]/g, "");

        if (!["A", "B", "C", "D"].includes(correct)) {
          failedQuestions.push({ index: i, reason: "Invalid correctAnswer" });
          continue;
        }

        const correctIndex = correct.charCodeAt(0) - 65;

        const answers = q.options.map((text, index) => ({
          text: text.trim(),
          correct: index === correctIndex,
        }));

        await Question.create({
          quizId,
          question: q.questionText.trim(),
          answers,
          createdBy: req.user.id,
        });

        createdQuestions.push(q);
      } catch (err) {
        failedQuestions.push({ index: i, reason: err.message });
      }
    }

    if (createdQuestions.length === 0) {
      await Quiz.deleteOne({ quizId });
      return res.status(400).json({
        message: "No valid questions created. Quiz removed.",
        failedQuestions,
      });
    }

    emitQuizNotification(req, {
      channelId,
      channelName: channelName || "Unknown Channel",
      type: "quiz_created",
      title: `Quiz AI mới: ${title}`,
      body: `${req.user.fullName || req.user.name} đã tạo quiz AI "${title}"`,
      quizId,
    }).catch(() => {});

    res.status(201).json({
      message: "Quiz saved",
      quiz,
      questionsCreated: createdQuestions.length,
      totalQuestions: questions.length,
      failedQuestions: failedQuestions.length,
      failedDetails:
        failedQuestions.length > 0 ? failedQuestions : undefined,
    });
  } catch (error) {
    console.error("[SAVE QUIZ ERROR]", error);
    res.status(500).json({
      message: "Error saving quiz",
      error: error.message,
    });
  }
};


// ============ TEACHER & ADMIN ============

// Tạo quiz mới (Teacher/Admin)
const createQuiz = async (req, res) => {
  try {
    const { quizId, title, timeLimit, channelId, channelName } = req.body;

    if (!quizId || !title || !channelId) {
      return res
        .status(400)
        .json({ message: "quizId, title, and channelId are required" });
    }

    // Kiểm tra quizId đã tồn tại chưa
    const existing = await Quiz.findOne({ quizId });
    if (existing) {
      return res.status(400).json({ message: "Quiz ID already exists" });
    }

    const quiz = await Quiz.create({
      quizId,
      title,
      owner: req.user.id,
      ownerName: req.user.fullName || req.user.name,
      channelId,
      channelName: channelName || "Unknown Channel",
      timeLimit: timeLimit || 0,
    });

    emitQuizNotification(req, {
      channelId,
      channelName: channelName || "Unknown Channel",
      type: "quiz_created",
      title: `Quiz mới: ${title}`,
      body: `${req.user.fullName || req.user.name} đã tạo quiz "${title}"`,
      quizId,
    }).catch(() => {});

    res.status(201).json(quiz);
  } catch (error) {
    console.error("[CREATE QUIZ ERROR]", error);
    res
      .status(500)
      .json({ message: "Error creating quiz", error: error.message });
  }
};

// Lấy danh sách quiz của teacher (Teacher)
const getMyQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ owner: req.user.id })
      .sort({ updatedAt: -1 })
      .lean();

    res.json(quizzes);
  } catch (error) {
    console.error("[GET MY QUIZZES ERROR]", error);
    res
      .status(500)
      .json({ message: "Error fetching quizzes", error: error.message });
  }
};

// Lấy danh sách quiz của một channel (All roles)
const getQuizzesByChannel = async (req, res) => {
  try {
    const { channelId } = req.params;

    if (!channelId) {
      return res.status(400).json({ message: "channelId is required" });
    }

    const quizzes = await Quiz.find({ channelId })
      .sort({ updatedAt: -1 })
      .lean();

    res.json(quizzes);
  } catch (error) {
    console.error("[GET CHANNEL QUIZZES ERROR]", error);
    res.status(500).json({
      message: "Error fetching channel quizzes",
      error: error.message,
    });
  }
};

// Lấy tất cả quiz (Admin only)
const getAllQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find().sort({ updatedAt: -1 }).lean();

    res.json(quizzes);
  } catch (error) {
    console.error("[GET ALL QUIZZES ERROR]", error);
    res
      .status(500)
      .json({ message: "Error fetching quizzes", error: error.message });
  }
};

// Cập nhật quiz (Teacher - own quiz, Admin - any quiz)
const updateQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { title, timeLimit } = req.body;

    // Find quiz
    const quiz = await Quiz.findOne({ quizId });

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check permissions: teacher can only update own quiz, admin can update any
    if (req.user.role !== "admin" && quiz.owner !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You can only update your own quizzes" });
    }

    // Update fields
    if (title) quiz.title = title;
    if (timeLimit !== undefined) quiz.timeLimit = timeLimit;

    await quiz.save();

    res.json(quiz);
  } catch (error) {
    console.error("[UPDATE QUIZ ERROR]", error);
    res
      .status(500)
      .json({ message: "Error updating quiz", error: error.message });
  }
};

// Xóa quiz (Teacher - own quiz, Admin - any quiz)
const deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ quizId });

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check permissions
    if (req.user.role !== "admin" && quiz.owner !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You can only delete your own quizzes" });
    }

    // Xóa quiz, câu hỏi và kết quả
    await Quiz.deleteOne({ quizId });
    await Question.deleteMany({ quizId });
    await Result.deleteMany({ quizId });

    res.json({ message: "Quiz deleted successfully" });
  } catch (error) {
    console.error("[DELETE QUIZ ERROR]", error);
    res
      .status(500)
      .json({ message: "Error deleting quiz", error: error.message });
  }
};

// Start quiz (Teacher - own quiz, Admin - any quiz)
const startQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ quizId });

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check permissions
    if (req.user.role !== "admin" && quiz.owner !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You can only start your own quizzes" });
    }

    quiz.isActive = true;
    await quiz.save();

    emitQuizNotification(req, {
      channelId: quiz.channelId,
      channelName: quiz.channelName,
      type: "quiz_started",
      title: `Quiz đang diễn ra: ${quiz.title}`,
      body: `Quiz "${quiz.title}" đã được mở — hãy vào làm ngay!`,
      quizId: quiz.quizId,
    }).catch(() => {});

    res.json(quiz);
  } catch (error) {
    console.error("[START QUIZ ERROR]", error);
    res
      .status(500)
      .json({ message: "Error starting quiz", error: error.message });
  }
};

// Stop quiz (Teacher - own quiz, Admin - any quiz)
const stopQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ quizId });

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check permissions
    if (req.user.role !== "admin" && quiz.owner !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You can only stop your own quizzes" });
    }

    quiz.isActive = false;
    await quiz.save();

    res.json(quiz);
  } catch (error) {
    console.error("[STOP QUIZ ERROR]", error);
    res
      .status(500)
      .json({ message: "Error stopping quiz", error: error.message });
  }
};

// Stop all quizzes (Admin/Teacher)
const stopAllQuizzes = async (req, res) => {
  try {
    const filter =
      req.user.role === "admin"
        ? { isActive: true }
        : { isActive: true, owner: req.user.id };

    const result = await Quiz.updateMany(filter, { $set: { isActive: false } });

    res.json({ message: "Quizzes stopped", modified: result.modifiedCount });
  } catch (error) {
    console.error("[STOP ALL QUIZZES ERROR]", error);
    res
      .status(500)
      .json({ message: "Error stopping quizzes", error: error.message });
  }
};

// Thêm câu hỏi vào quiz
const addQuestion = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { question, answers } = req.body;

    if (!question || !Array.isArray(answers) || answers.length !== 4) {
      return res.status(400).json({ message: "Invalid question format" });
    }

    const correctCount = answers.filter((a) => a.correct === true).length;
    if (correctCount !== 1) {
      return res
        .status(400)
        .json({ message: "Exactly one correct answer required" });
    }

    const quiz = await Quiz.findOne({ quizId });
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check permissions
    if (req.user.role !== "admin" && quiz.owner !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You can only add questions to your own quizzes" });
    }

    const newQuestion = await Question.create({
      quizId,
      question,
      answers,
      createdBy: req.user.id,
    });

    res.status(201).json(newQuestion);
  } catch (error) {
    console.error("[ADD QUESTION ERROR]", error);
    res
      .status(500)
      .json({ message: "Error adding question", error: error.message });
  }
};

// Lấy câu hỏi với đáp án (Teacher/Admin - for editing)
const getQuestionsWithAnswers = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ quizId }).lean();
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check permissions
    if (req.user.role !== "admin" && quiz.owner !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const questions = await Question.find({ quizId })
      .select("question answers createdAt")
      .sort({ createdAt: 1 })
      .lean();

    res.json({ quiz, questions });
  } catch (error) {
    console.error("[GET QUESTIONS ERROR]", error);
    res
      .status(500)
      .json({ message: "Error fetching questions", error: error.message });
  }
};

// Cập nhật câu hỏi
const updateQuestion = async (req, res) => {
  try {
    const { quizId, questionId } = req.params;
    const { question, answers } = req.body;

    if (!isValidObjectId(questionId)) {
      return res.status(400).json({ message: "questionId không hợp lệ" });
    }

    if (!question || !Array.isArray(answers) || answers.length !== 4) {
      return res.status(400).json({ message: "Invalid question format" });
    }

    const correctCount = answers.filter((a) => a.correct === true).length;
    if (correctCount !== 1) {
      return res
        .status(400)
        .json({ message: "Exactly one correct answer required" });
    }

    const quiz = await Quiz.findOne({ quizId });
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check permissions
    if (req.user.role !== "admin" && quiz.owner !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updated = await Question.findOneAndUpdate(
      { _id: questionId, quizId },
      { question, answers },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("[UPDATE QUESTION ERROR]", error);
    res
      .status(500)
      .json({ message: "Error updating question", error: error.message });
  }
};

// Xóa câu hỏi
const deleteQuestion = async (req, res) => {
  try {
    const { quizId, questionId } = req.params;

    if (!isValidObjectId(questionId)) {
      return res.status(400).json({ message: "questionId không hợp lệ" });
    }

    const quiz = await Quiz.findOne({ quizId });
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check permissions
    if (req.user.role !== "admin" && quiz.owner !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    await Question.deleteOne({ _id: questionId, quizId });

    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error("[DELETE QUESTION ERROR]", error);
    res
      .status(500)
      .json({ message: "Error deleting question", error: error.message });
  }
};

// Leaderboard - Danh sách kết quả
const getLeaderboard = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ quizId }).lean();
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check permissions
    if (req.user.role !== "admin" && quiz.owner !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const results = await Result.find({ quizId })
      .sort({ score: -1, timeUsed: 1, createdAt: 1 })
      .lean();

    res.json(
      results.map((r) => ({
        id: r._id,
        userId: r.userId,
        userName: r.userName,
        score: r.score,
        total: r.total,
        attempt: r.attempt,
        timeUsed: r.timeUsed,
        createdAt: r.createdAt,
      }))
    );
  } catch (error) {
    console.error("[GET LEADERBOARD ERROR]", error);
    res
      .status(500)
      .json({ message: "Error fetching leaderboard", error: error.message });
  }
};

// Xóa leaderboard
const clearLeaderboard = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ quizId }).lean();
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check permissions
    if (req.user.role !== "admin" && quiz.owner !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    await Result.deleteMany({ quizId });

    res.json({ message: "Leaderboard cleared successfully" });
  } catch (error) {
    console.error("[CLEAR LEADERBOARD ERROR]", error);
    res
      .status(500)
      .json({ message: "Error clearing leaderboard", error: error.message });
  }
};

// Chi tiết 1 kết quả
const getResultDetail = async (req, res) => {
  try {
    const { quizId, resultId } = req.params;

    if (!isValidObjectId(resultId)) {
      return res.status(400).json({ message: "resultId không hợp lệ" });
    }

    const quiz = await Quiz.findOne({ quizId }).lean();
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check permissions
    if (req.user.role !== "admin" && quiz.owner !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await Result.findOne({ _id: resultId, quizId }).lean();
    if (!result) {
      return res.status(404).json({ message: "Result not found" });
    }

    const questions = await Question.find({ quizId })
      .sort({ createdAt: 1 })
      .select("question answers")
      .lean();

    res.json({
      user: { userId: result.userId, userName: result.userName },
      quiz: { quizId, title: quiz.title },
      score: result.score,
      total: result.total,
      attempt: result.attempt,
      timeUsed: result.timeUsed,
      createdAt: result.createdAt,
      answers: result.answers,
      questions,
    });
  } catch (error) {
    console.error("[GET RESULT DETAIL ERROR]", error);
    res
      .status(500)
      .json({ message: "Error fetching result detail", error: error.message });
  }
};

// ============ PUBLIC / STUDENT ============

// Lấy danh sách quiz đang mở
const getActiveQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ isActive: true })
      .select("quizId title ownerName updatedAt timeLimit")
      .sort({ updatedAt: -1 })
      .lean();

    res.json(quizzes);
  } catch (error) {
    console.error("[GET ACTIVE QUIZZES ERROR]", error);
    res
      .status(500)
      .json({ message: "Error fetching active quizzes", error: error.message });
  }
};

// Bắt đầu làm bài - tạo session phía server, trả về câu hỏi đã xáo trộn
const beginQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ quizId, isActive: true }).lean();
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found or not active" });
    }

    const allQuestions = await Question.find({ quizId })
      .sort({ createdAt: 1 })
      .lean();

    if (!allQuestions.length) {
      return res.status(400).json({ message: "Quiz has no questions" });
    }

    // Reuse active session if student refreshed mid-quiz
    const existingSession = await QuizSession.findOne({
      quizId,
      userId: req.user.id,
      submitted: false,
    }).lean();

    if (existingSession) {
      const notExpired =
        !existingSession.expiresAt || existingSession.expiresAt > new Date();
      if (notExpired) {
        const shuffledQuestions = existingSession.questionOrder.map((i) => {
          const q = allQuestions[i];
          return {
            _id: q._id,
            question: q.question,
            answers: q.answers.map((a) => ({ text: a.text })),
          };
        });
        return res.json({
          sessionId: existingSession._id,
          expiresAt: existingSession.expiresAt,
          questions: shuffledQuestions,
          title: quiz.title,
          resuming: true,
        });
      }
      // Expired: mark it and create a new session
      await QuizSession.findByIdAndUpdate(existingSession._id, {
        submitted: true,
      });
    }

    // Fisher-Yates shuffle of question indices
    const questionOrder = allQuestions.map((_, i) => i);
    for (let i = questionOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questionOrder[i], questionOrder[j]] = [questionOrder[j], questionOrder[i]];
    }

    const now = new Date();
    const expiresAt =
      quiz.timeLimit > 0
        ? new Date(now.getTime() + quiz.timeLimit * 1000)
        : null;

    const session = await QuizSession.create({
      userId: req.user.id,
      quizId,
      startedAt: now,
      expiresAt,
      questionOrder,
    });

    const shuffledQuestions = questionOrder.map((i) => {
      const q = allQuestions[i];
      return {
        _id: q._id,
        question: q.question,
        answers: q.answers.map((a) => ({ text: a.text })),
      };
    });

    res.json({
      sessionId: session._id,
      expiresAt,
      questions: shuffledQuestions,
      title: quiz.title,
      resuming: false,
    });
  } catch (error) {
    console.error("[BEGIN QUIZ ERROR]", error);
    res
      .status(500)
      .json({ message: "Error beginning quiz", error: error.message });
  }
};

// Lấy câu hỏi (không có đáp án) - cho student làm bài
const getQuestions = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ quizId, isActive: true }).lean();
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found or not active" });
    }

    const questions = await Question.find({ quizId })
      .select("question answers")
      .sort({ createdAt: 1 })
      .lean();

    // Remove correct answer info
    const sanitizedQuestions = questions.map((q) => ({
      _id: q._id,
      question: q.question,
      answers: q.answers.map((a) => ({ text: a.text })),
    }));

    res.json({
      quizId: quiz.quizId,
      title: quiz.title,
      timeLimit: quiz.timeLimit,
      questions: sanitizedQuestions,
    });
  } catch (error) {
    console.error("[GET QUESTIONS ERROR]", error);
    res
      .status(500)
      .json({ message: "Error fetching questions", error: error.message });
  }
};

// Nộp bài (Student)
const submitQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers, sessionId, tabSwitches } = req.body;

    // Validate session
    if (!sessionId || !isValidObjectId(sessionId)) {
      return res.status(400).json({ message: "Session ID không hợp lệ" });
    }

    const session = await QuizSession.findById(sessionId);
    if (!session) {
      return res.status(400).json({ message: "Session không tồn tại, hãy bắt đầu bài làm lại" });
    }
    if (session.userId !== req.user.id) {
      return res.status(403).json({ message: "Session không thuộc về bạn" });
    }
    if (session.quizId !== quizId) {
      return res.status(400).json({ message: "Session không khớp với quiz này" });
    }
    if (session.submitted) {
      return res.status(400).json({ message: "Bài đã được nộp, không thể nộp lại" });
    }

    const now = new Date();
    if (session.expiresAt && now > session.expiresAt) {
      session.submitted = true;
      await session.save();
      return res.status(400).json({ message: "Đã hết thời gian làm bài" });
    }

    const quiz = await Quiz.findOne({ quizId }).lean();
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const allQuestions = await Question.find({ quizId })
      .sort({ createdAt: 1 })
      .lean();

    const questions = session.questionOrder.map((i) => allQuestions[i]);

    if (!questions.length) {
      return res.status(400).json({ message: "Quiz has no questions" });
    }

    if (!Array.isArray(answers) || answers.length !== questions.length) {
      return res.status(400).json({ message: "Invalid answers data" });
    }

    // Tính timeUsed phía server (không tin client)
    const timeUsed = Math.round((now - session.startedAt) / 1000);

    // Chấm điểm
    let score = 0;
    const detail = questions.map((q, i) => {
      const correctIndex = q.answers.findIndex((a) => a.correct === true);
      const your = Number(answers[i]);
      const ok = your === correctIndex;
      if (ok) score += 1;
      return { questionId: q._id, your, correct: correctIndex, ok };
    });

    // Tính lần làm thứ mấy
    const lastResult = await Result.findOne({ quizId, userId: req.user.id })
      .sort({ attempt: -1 })
      .lean();
    const attempt = (lastResult?.attempt || 0) + 1;

    // Lưu kết quả
    const result = await Result.create({
      userId: req.user.id,
      userName: req.user.fullName || req.user.name,
      quizId,
      quizTitle: quiz.title,
      attempt,
      score,
      total: questions.length,
      timeUsed,
      tabSwitches: typeof tabSwitches === "number" ? tabSwitches : 0,
      answers: detail,
    });

    // Đánh dấu session đã nộp
    session.submitted = true;
    session.tabSwitches = typeof tabSwitches === "number" ? tabSwitches : 0;
    await session.save();

    res.json({
      resultId: result._id,
      total: questions.length,
      score,
      attempt,
      timeUsed,
      detail,
    });
  } catch (error) {
    console.error("[SUBMIT QUIZ ERROR]", error);
    res
      .status(500)
      .json({ message: "Error submitting quiz", error: error.message });
  }
};

// Lấy kết quả của chính mình
const getMyResults = async (req, res) => {
  try {
    const { quizId } = req.params;

    const results = await Result.find({ quizId, userId: req.user.id })
      .sort({ attempt: -1 })
      .lean();

    res.json(results);
  } catch (error) {
    console.error("[GET MY RESULTS ERROR]", error);
    res
      .status(500)
      .json({ message: "Error fetching results", error: error.message });
  }
};

module.exports = {
  // AI Generation
  generateQuizWithAI,
  saveGeneratedQuiz,

  // Teacher/Admin
  createQuiz,
  getMyQuizzes,
  getAllQuizzes,
  getQuizzesByChannel,
  updateQuiz,
  deleteQuiz,
  startQuiz,
  stopQuiz,
  stopAllQuizzes,
  addQuestion,
  getQuestionsWithAnswers,
  updateQuestion,
  deleteQuestion,
  getLeaderboard,
  clearLeaderboard,
  getResultDetail,

  // Public/Student
  getActiveQuizzes,
  beginQuiz,
  getQuestions,
  submitQuiz,
  getMyResults,
};
