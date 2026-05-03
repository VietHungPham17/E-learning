import React, { useState, useEffect } from "react";
import Cookies from "universal-cookie";
import { useChatContext } from "stream-chat-react";
import "./ChannelQuizView.css";
import QuizEditor from "./QuizEditor";
import QuizTaker from "./QuizTaker";
import QuizResults from "./QuizResults";
import MyResults from "./MyResults";
import QuizMaker from "./QuizMaker";
import geminiService from "../services/geminiService";
import apiClient from "../services/apiClient";

const cookies = new Cookies();

const ChannelQuizView = ({ userRole }) => {
  const { channel } = useChatContext();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("list"); // list, create, edit, take, results, generate
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  const [quizForm, setQuizForm] = useState({
    quizId: "",
    title: "",
    timeLimit: 0,
  });

  useEffect(() => {
    if (channel) {
      fetchChannelQuizzes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const fetchChannelQuizzes = async () => {
    if (!channel) return;

    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get(`/quiz/channel/${channel.id}`);
      setQuizzes(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Error fetching quizzes");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    setError("");

    if (!channel) {
      setError("No channel selected");
      return;
    }

    try {
      await apiClient.post("/quiz", {
        ...quizForm,
        channelId: channel.id,
        channelName: channel.data?.name || channel.data?.id,
      });

      alert("Quiz created successfully!");
      setQuizForm({ quizId: "", title: "", timeLimit: 0 });
      setViewMode("list");
      fetchChannelQuizzes();
    } catch (err) {
      setError(err.response?.data?.message || "Error creating quiz");
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    if (!window.confirm("Are you sure you want to delete this quiz?")) return;

    try {
      await apiClient.delete(`/quiz/${quizId}`);

      alert("Quiz deleted successfully!");
      fetchChannelQuizzes();
    } catch (err) {
      setError(err.response?.data?.message || "Error deleting quiz");
    }
  };

  const handleGenerateQuiz = async ({ topics, questionCount, difficulty }) => {
    setLoading(true);
    setError("");

    try {
      console.log("[CHANNEL QUIZ] Generating quiz with:", {
        topics,
        questionCount,
        difficulty,
      });

      const response = await geminiService.generateQuiz({
        topics,
        questionCount,
        difficulty,
      });

      console.log("[CHANNEL QUIZ] Quiz generated:", {
        title: response.title,
        questionCount: response.questions?.length,
      });

      if (!response.questions || response.questions.length === 0) {
        throw new Error("No questions were generated. Please try again.");
      }

      const timestamp = Date.now();
      const quizData = {
        quizId: `AI_${channel.id}_${timestamp}`,
        title: response.title || `AI Quiz: ${topics.slice(0, 2).join(", ")}`,
        timeLimit: Math.max(questionCount * 60, 300), // At least 5 minutes or 1 minute per question
        channelId: channel.id,
        channelName:
          channel.data?.name || channel.data?.id || "Unknown Channel",
        questions: response.questions,
      };

      console.log("[CHANNEL QUIZ] Saving quiz:", quizData.quizId);

      const saveResult = await geminiService.saveGeneratedQuiz(quizData);

      console.log("[CHANNEL QUIZ] Quiz saved successfully:", {
        quizId: saveResult.quiz?.quizId,
        questionsCount: saveResult.questionsCount,
      });

      alert(
        `Quiz generated successfully!\n\n` +
          `Title: ${quizData.title}\n` +
          `Questions: ${saveResult.questionsCount}/${saveResult.totalRequested}\n` +
          `Quiz ID: ${saveResult.quiz?.quizId}`,
      );

      setViewMode("list");
      await fetchChannelQuizzes();
    } catch (err) {
      console.error("[CHANNEL QUIZ] Error generating quiz:", err);

      const errorMessage =
        err.message ||
        err.response?.data?.message ||
        "Error generating quiz with AI";

      setError(errorMessage);

      alert(
        `Failed to generate quiz\n\nError: ${errorMessage}\n\nPlease try again.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggleQuiz = async (quizId, isActive) => {
    try {
      const action = isActive ? "stop" : "start";
      await apiClient.post(`/quiz/${quizId}/${action}`);

      alert(`Quiz ${action}ed successfully!`);
      fetchChannelQuizzes();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          `Error ${isActive ? "stopping" : "starting"} quiz`,
      );
    }
  };

  if (!channel) {
    return (
      <div className="channel-quiz-view">
        <div className="channel-quiz-empty">
          <p>Please select a channel to view quizzes</p>
        </div>
      </div>
    );
  }

  if (viewMode === "create") {
    return (
      <div className="channel-quiz-view">
        <div className="quiz-form-container">
          <h2>Create New Quiz for {channel.data?.name || "This Channel"}</h2>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleCreateQuiz} className="quiz-form">
            <div className="form-group">
              <label>Quiz ID (unique)*</label>
              <input
                type="text"
                required
                value={quizForm.quizId}
                onChange={(e) =>
                  setQuizForm({ ...quizForm, quizId: e.target.value })
                }
                placeholder="e.g., MATH101"
              />
            </div>
            <div className="form-group">
              <label>Title*</label>
              <input
                type="text"
                required
                value={quizForm.title}
                onChange={(e) =>
                  setQuizForm({ ...quizForm, title: e.target.value })
                }
                placeholder="e.g., Mathematics Quiz 1"
              />
            </div>
            <div className="form-group">
              <label>Time Limit (seconds, 0 for no limit)</label>
              <input
                type="number"
                min="0"
                value={quizForm.timeLimit}
                onChange={(e) =>
                  setQuizForm({
                    ...quizForm,
                    timeLimit: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Create Quiz
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setViewMode("list")}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (viewMode === "edit" && selectedQuiz) {
    return (
      <QuizEditor
        quiz={selectedQuiz}
        channel={channel}
        onBack={() => {
          setViewMode("list");
          setSelectedQuiz(null);
          fetchChannelQuizzes();
        }}
      />
    );
  }

  if (viewMode === "take" && selectedQuiz) {
    return (
      <QuizTaker
        quiz={selectedQuiz}
        onBack={() => {
          setViewMode("list");
          setSelectedQuiz(null);
        }}
      />
    );
  }

  if (viewMode === "results" && selectedQuiz) {
    return (
      <QuizResults
        quiz={selectedQuiz}
        onBack={() => {
          setViewMode("list");
          setSelectedQuiz(null);
        }}
      />
    );
  }

  if (viewMode === "my-results" && selectedQuiz) {
    return (
      <MyResults
        quiz={selectedQuiz}
        onBack={() => {
          setViewMode("list");
          setSelectedQuiz(null);
        }}
      />
    );
  }

  if (viewMode === "generate") {
    return (
      <div className="channel-quiz-view">
        <QuizMaker
          onBack={() => setViewMode("list")}
          onGenerate={handleGenerateQuiz}
        />
      </div>
    );
  }

  return (
    <div className="channel-quiz-view">
      <div className="quiz-header">
        <h2>Quizzes in {channel.data?.name || "This Channel"}</h2>
        {(userRole === "teacher" || userRole === "admin") && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="btn-create"
              onClick={() => setViewMode("generate")}
            >
              Generate Quiz
            </button>
            <button
              className="btn-create"
              onClick={() => {
                setViewMode("create");
                setQuizForm({ quizId: "", title: "", timeLimit: 0 });
              }}
            >
              + Create New Quiz
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="quiz-list">
          {quizzes.length === 0 ? (
            <p>
              No quizzes found in this channel.
              {(userRole === "teacher" || userRole === "admin") &&
                " Create your first quiz!"}
            </p>
          ) : (
            quizzes.map((quiz) => (
              <div key={quiz._id} className="quiz-item">
                <div className="quiz-info">
                  <h3>{quiz.title}</h3>
                  <p>ID: {quiz.quizId}</p>
                  <p>
                    Time Limit: {quiz.timeLimit || "No limit"}{" "}
                    {quiz.timeLimit > 0 && "seconds"}
                  </p>
                  <p>
                    Status:{" "}
                    <span
                      className={
                        quiz.isActive ? "status-active" : "status-inactive"
                      }
                    >
                      {quiz.isActive ? "Active" : "Inactive"}
                    </span>
                  </p>
                  <p>Created by: {quiz.ownerName}</p>
                </div>
                <div className="quiz-actions">
                  {userRole === "student" ? (
                    <>
                      {quiz.isActive && (
                        <button
                          className="btn-primary"
                          onClick={() => {
                            setSelectedQuiz(quiz);
                            setViewMode("take");
                          }}
                        >
                          Take Quiz
                        </button>
                      )}
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setSelectedQuiz(quiz);
                          setViewMode("my-results");
                        }}
                      >
                        My Results
                      </button>
                    </>
                  ) : (
                    <>
                      {(userRole === "admin" ||
                        quiz.owner === cookies.get("userId")) && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedQuiz(quiz);
                              setViewMode("edit");
                            }}
                          >
                            Edit Questions
                          </button>
                          <button
                            className={quiz.isActive ? "btn-stop" : "btn-start"}
                            onClick={() =>
                              handleToggleQuiz(quiz.quizId, quiz.isActive)
                            }
                          >
                            {quiz.isActive ? "Stop" : "Start"}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedQuiz(quiz);
                              setViewMode("results");
                            }}
                          >
                            View Results
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => handleDeleteQuiz(quiz.quizId)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ChannelQuizView;
