const express = require("express");
const router = express.Router();
const {
  authRequired,
  requireRole,
  requireAdminOrTeacher,
} = require("../middleware/quizAuth");
const quizController = require("../controllers/quiz");

router.post(
  "/generate-ai",
  authRequired,
  requireAdminOrTeacher,
  quizController.generateQuizWithAI
);
router.post(
  "/save-generated",
  authRequired,
  requireAdminOrTeacher,
  quizController.saveGeneratedQuiz
);

router.post(
  "/",
  authRequired,
  requireAdminOrTeacher,
  quizController.createQuiz
);
router.get(
  "/mine",
  authRequired,
  requireRole("teacher"),
  quizController.getMyQuizzes
);
router.get(
  "/all",
  authRequired,
  requireRole("admin"),
  quizController.getAllQuizzes
);
router.get(
  "/channel/:channelId",
  authRequired,
  quizController.getQuizzesByChannel
);
router.put(
  "/:quizId",
  authRequired,
  requireAdminOrTeacher,
  quizController.updateQuiz
);
router.delete(
  "/:quizId",
  authRequired,
  requireAdminOrTeacher,
  quizController.deleteQuiz
);

router.post(
  "/:quizId/start",
  authRequired,
  requireAdminOrTeacher,
  quizController.startQuiz
);
router.post(
  "/:quizId/stop",
  authRequired,
  requireAdminOrTeacher,
  quizController.stopQuiz
);
router.post(
  "/stop-all",
  authRequired,
  requireAdminOrTeacher,
  quizController.stopAllQuizzes
);

router.post(
  "/:quizId/questions",
  authRequired,
  requireAdminOrTeacher,
  quizController.addQuestion
);
router.get(
  "/:quizId/questions/full",
  authRequired,
  requireAdminOrTeacher,
  quizController.getQuestionsWithAnswers
);
router.put(
  "/:quizId/questions/:questionId",
  authRequired,
  requireAdminOrTeacher,
  quizController.updateQuestion
);
router.delete(
  "/:quizId/questions/:questionId",
  authRequired,
  requireAdminOrTeacher,
  quizController.deleteQuestion
);

router.get(
  "/:quizId/leaderboard",
  authRequired,
  requireAdminOrTeacher,
  quizController.getLeaderboard
);
router.delete(
  "/:quizId/leaderboard",
  authRequired,
  requireAdminOrTeacher,
  quizController.clearLeaderboard
);
router.get(
  "/:quizId/results/:resultId",
  authRequired,
  requireAdminOrTeacher,
  quizController.getResultDetail
);

router.get("/active", quizController.getActiveQuizzes);

router.post(
  "/:quizId/begin",
  authRequired,
  requireRole("student"),
  quizController.beginQuiz
);

router.get("/:quizId/questions", authRequired, quizController.getQuestions);

router.post(
  "/:quizId/submit",
  authRequired,
  requireRole("student"),
  quizController.submitQuiz
);

router.get("/:quizId/my-results", authRequired, quizController.getMyResults);

module.exports = router;
