import React, { useState, useEffect } from "react";
import axios from "axios";
import Cookies from "universal-cookie";
import "./QuizDashboard.css";
import QuizMaker from "./QuizMaker";

const cookies = new Cookies();
const API_URL = "http://localhost:6036";

const QuizDashboard = ({ userRole, isCollapsed }) => {
  const [quizzes, setQuizzes] = useState([]);
  const [activeQuizzes, setActiveQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [viewMode, setViewMode] = useState("list");

  const [quizForm, setQuizForm] = useState({
    quizId: "",
    title: "",
    timeLimit: 0,
  });

  const getAuthHeaders = () => {
    const token = cookies.get("token");
    const userId = cookies.get("userId");
    return {
      Authorization: `Bearer ${token}`,
      "X-User-Id": userId,
    };
  };

  const fetchQuizzes = async () => {
    setLoading(true);
    setError("");
    try {
      let url = "";
      if (userRole === "admin") {
        url = `${API_URL}/quiz/all`;
      } else if (userRole === "teacher") {
        url = `${API_URL}/quiz/mine`;
      } else {
        return; // Students don't need this
      }

      const response = await axios.get(url, {
        headers: getAuthHeaders(),
      });
      setQuizzes(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Error fetching quizzes");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveQuizzes = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API_URL}/quiz/active`);
      setActiveQuizzes(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Error fetching active quizzes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === "student") {
      fetchActiveQuizzes();
    } else {
      fetchQuizzes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await axios.post(`${API_URL}/quiz`, quizForm, {
        headers: getAuthHeaders(),
      });

      alert("Quiz created successfully!");
      setQuizForm({ quizId: "", title: "", timeLimit: 0 });
      setViewMode("list");
      fetchQuizzes();
    } catch (err) {
      setError(err.response?.data?.message || "Error creating quiz");
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    if (!window.confirm("Are you sure you want to delete this quiz?")) return;

    try {
      await axios.delete(`${API_URL}/quiz/${quizId}`, {
        headers: getAuthHeaders(),
      });

      alert("Quiz deleted successfully!");
      fetchQuizzes();
    } catch (err) {
      setError(err.response?.data?.message || "Error deleting quiz");
    }
  };

  const handleToggleQuiz = async (quizId, isActive) => {
    try {
      const action = isActive ? "stop" : "start";
      await axios.post(`${API_URL}/quiz/${quizId}/${action}`, null, {
        headers: getAuthHeaders(),
      });

      alert(`Quiz ${action}ed successfully!`);
      fetchQuizzes();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          `Error ${isActive ? "stopping" : "starting"} quiz`,
      );
    }
  };

  const renderQuizManagement = () => (
    <div className="quiz-management">
      <div className="quiz-header">
        <h2>Manage Quizzes</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className="btn-create"
            onClick={() => {
              setViewMode("generate");
            }}
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
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="quiz-list">
          {quizzes.length === 0 ? (
            <p>No quizzes found. Create your first quiz!</p>
          ) : (
            quizzes.map((quiz) => (
              <div key={quiz._id} className="quiz-item">
                <div className="quiz-info">
                  <h3>{quiz.title}</h3>
                  <p>ID: {quiz.quizId}</p>
                  <p>Time Limit: {quiz.timeLimit || "No limit"} seconds</p>
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
                  {userRole === "admin" && <p>Owner: {quiz.ownerName}</p>}
                </div>
                <div className="quiz-actions">
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
                    onClick={() => handleToggleQuiz(quiz.quizId, quiz.isActive)}
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
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  const renderCreateQuiz = () => (
    <div className="quiz-form-container">
      <h2>Create New Quiz</h2>
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
              setQuizForm({ ...quizForm, timeLimit: parseInt(e.target.value) })
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
  );

  const renderAvailableQuizzes = () => (
    <div className="available-quizzes">
      <h2>Available Quizzes</h2>
      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="quiz-list">
          {activeQuizzes.length === 0 ? (
            <p>No active quizzes available at the moment.</p>
          ) : (
            activeQuizzes.map((quiz) => (
              <div key={quiz._id} className="quiz-item">
                <div className="quiz-info">
                  <h3>{quiz.title}</h3>
                  <p>Created by: {quiz.ownerName}</p>
                  {quiz.timeLimit > 0 && (
                    <p>Time Limit: {quiz.timeLimit} seconds</p>
                  )}
                </div>
                <div className="quiz-actions">
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setSelectedQuiz(quiz);
                      setViewMode("take");
                    }}
                  >
                    Take Quiz
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setSelectedQuiz(quiz);
                      setViewMode("my-results");
                    }}
                  >
                    My Results
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  const handleGenerateQuiz = async (config) => {
    try {
      console.log("Generating quiz with config:", config);
      alert(
        `Generating quiz with ${
          config.questionCount
        } questions on topics: ${config.topics.join(", ")} at ${
          config.difficulty
        } difficulty`,
      );
      setViewMode("list");
    } catch (error) {
      console.error("Error generating quiz:", error);
      throw error;
    }
  };

  return (
    <div className={`quiz-dashboard ${isCollapsed ? "collapsed" : ""}`}>
      {viewMode === "list" && userRole !== "student" && renderQuizManagement()}
      {viewMode === "list" &&
        userRole === "student" &&
        renderAvailableQuizzes()}
      {viewMode === "generate" && (
        <QuizMaker
          onBack={() => setViewMode("list")}
          onGenerate={handleGenerateQuiz}
        />
      )}
      {viewMode === "create" && renderCreateQuiz()}
      {viewMode === "edit" && selectedQuiz && (
        <QuizEditor
          quiz={selectedQuiz}
          onBack={() => {
            setViewMode("list");
            setSelectedQuiz(null);
            fetchQuizzes();
          }}
          getAuthHeaders={getAuthHeaders}
        />
      )}
      {viewMode === "take" && selectedQuiz && (
        <QuizTaker
          quiz={selectedQuiz}
          onBack={() => {
            setViewMode("list");
            setSelectedQuiz(null);
          }}
          getAuthHeaders={getAuthHeaders}
        />
      )}
      {viewMode === "results" && selectedQuiz && (
        <QuizResults
          quiz={selectedQuiz}
          onBack={() => {
            setViewMode("list");
            setSelectedQuiz(null);
          }}
          getAuthHeaders={getAuthHeaders}
        />
      )}
      {viewMode === "my-results" && selectedQuiz && (
        <MyResults
          quiz={selectedQuiz}
          onBack={() => {
            setViewMode("list");
            setSelectedQuiz(null);
          }}
          getAuthHeaders={getAuthHeaders}
        />
      )}
    </div>
  );
};

function QuizEditor({ quiz, onBack, getAuthHeaders }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    question: "",
    answers: [
      { text: "", correct: false },
      { text: "", correct: false },
      { text: "", correct: false },
      { text: "", correct: false },
    ],
  });

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/quiz/${quiz.quizId}/questions/full`,
        { headers: getAuthHeaders() },
      );
      setQuestions(response.data.questions);
    } catch (err) {
      setError(err.response?.data?.message || "Error fetching questions");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setQuestionForm({
      question: "",
      answers: [
        { text: "", correct: false },
        { text: "", correct: false },
        { text: "", correct: false },
        { text: "", correct: false },
      ],
    });
    setEditingQuestion(null);
  };

  const handleSubmitQuestion = async (e) => {
    e.preventDefault();

    const correctCount = questionForm.answers.filter((a) => a.correct).length;
    if (correctCount !== 1) {
      alert("Exactly one answer must be correct!");
      return;
    }

    if (questionForm.answers.some((a) => !a.text.trim())) {
      alert("All answers must have text!");
      return;
    }

    try {
      if (editingQuestion) {
        await axios.put(
          `${API_URL}/quiz/${quiz.quizId}/questions/${editingQuestion._id}`,
          questionForm,
          { headers: getAuthHeaders() },
        );
        alert("Question updated!");
      } else {
        await axios.post(
          `${API_URL}/quiz/${quiz.quizId}/questions`,
          questionForm,
          { headers: getAuthHeaders() },
        );
        alert("Question added!");
      }

      resetForm();
      fetchQuestions();
    } catch (err) {
      setError(err.response?.data?.message || "Error saving question");
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm("Delete this question?")) return;

    try {
      await axios.delete(
        `${API_URL}/quiz/${quiz.quizId}/questions/${questionId}`,
        { headers: getAuthHeaders() },
      );
      alert("Question deleted!");
      fetchQuestions();
    } catch (err) {
      setError(err.response?.data?.message || "Error deleting question");
    }
  };

  const handleEditQuestion = (question) => {
    setEditingQuestion(question);
    setQuestionForm({
      question: question.question,
      answers: [...question.answers],
    });
  };

  return (
    <div className="quiz-editor">
      <div className="editor-header">
        <button onClick={onBack} className="btn-back">
          ← Back
        </button>
        <h2>Edit Quiz: {quiz.title}</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Question Form */}
      <div className="question-form-container">
        <h3>{editingQuestion ? "Edit Question" : "Add New Question"}</h3>
        <form onSubmit={handleSubmitQuestion} className="question-form">
          <div className="form-group">
            <label>Question*</label>
            <input
              type="text"
              required
              value={questionForm.question}
              onChange={(e) =>
                setQuestionForm({ ...questionForm, question: e.target.value })
              }
              placeholder="Enter your question"
            />
          </div>

          <div className="answers-group">
            <label>Answers (select one correct answer)*</label>
            {questionForm.answers.map((answer, index) => (
              <div key={index} className="answer-item">
                <input
                  type="radio"
                  name="correctAnswer"
                  checked={answer.correct}
                  onChange={() => {
                    const newAnswers = questionForm.answers.map((a, i) => ({
                      ...a,
                      correct: i === index,
                    }));
                    setQuestionForm({ ...questionForm, answers: newAnswers });
                  }}
                />
                <input
                  type="text"
                  required
                  value={answer.text}
                  onChange={(e) => {
                    const newAnswers = [...questionForm.answers];
                    newAnswers[index].text = e.target.value;
                    setQuestionForm({ ...questionForm, answers: newAnswers });
                  }}
                  placeholder={`Answer ${index + 1}`}
                />
              </div>
            ))}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingQuestion ? "Update Question" : "Add Question"}
            </button>
            {editingQuestion && (
              <button
                type="button"
                className="btn-secondary"
                onClick={resetForm}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Questions List */}
      <div className="questions-list">
        <h3>Questions ({questions.length})</h3>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : questions.length === 0 ? (
          <p>No questions yet. Add your first question!</p>
        ) : (
          questions.map((q, index) => (
            <div key={q._id} className="question-item">
              <div className="question-header">
                <h4>
                  {index + 1}. {q.question}
                </h4>
              </div>
              <div className="question-answers">
                {q.answers.map((a, i) => (
                  <div
                    key={i}
                    className={`answer ${a.correct ? "correct" : ""}`}
                  >
                    {String.fromCharCode(65 + i)}. {a.text}
                    {a.correct && " ✓"}
                  </div>
                ))}
              </div>
              <div className="question-actions">
                <button onClick={() => handleEditQuestion(q)}>Edit</button>
                <button
                  className="btn-delete"
                  onClick={() => handleDeleteQuestion(q._id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const QuizTaker = ({ quiz, onBack, getAuthHeaders }) => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit(true); // Auto submit
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const fetchQuestions = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/quiz/${quiz.quizId}/questions`,
        { headers: getAuthHeaders() },
      );
      setQuestions(response.data.questions);
      setAnswers(new Array(response.data.questions.length).fill(-1));
      if (response.data.timeLimit > 0) {
        setTimeLeft(response.data.timeLimit);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error fetching questions");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit && answers.some((a) => a === -1)) {
      if (!window.confirm("You haven't answered all questions. Submit anyway?"))
        return;
    }

    const timeUsed =
      quiz.timeLimit > 0 ? quiz.timeLimit - (timeLeft || 0) : null;

    try {
      const response = await axios.post(
        `${API_URL}/quiz/${quiz.quizId}/submit`,
        { answers, timeUsed },
        { headers: getAuthHeaders() },
      );
      setResult(response.data);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || "Error submitting quiz");
    }
  };

  if (loading) return <div className="loading">Loading quiz...</div>;
  if (error) return <div className="error-message">{error}</div>;

  if (submitted && result) {
    return (
      <div className="quiz-result">
        <h2>Quiz Completed!</h2>
        <div className="result-summary">
          <p className="score">
            Score: {result.score} / {result.total}
          </p>
          <p>Attempt: #{result.attempt}</p>
          <p>Percentage: {((result.score / result.total) * 100).toFixed(2)}%</p>
        </div>
        <div className="result-details">
          <h3>Review Answers:</h3>
          {result.detail.map((d, index) => (
            <div
              key={index}
              className={`answer-review ${d.ok ? "correct" : "wrong"}`}
            >
              <p>
                Question {index + 1}: {d.ok ? "✓ Correct" : "✗ Wrong"}
              </p>
              <p>Your answer: {String.fromCharCode(65 + d.your)}</p>
              {!d.ok && (
                <p className="correct-answer">
                  Correct answer: {String.fromCharCode(65 + d.correct)}
                </p>
              )}
            </div>
          ))}
        </div>
        <button onClick={onBack} className="btn-primary">
          Back to Quizzes
        </button>
      </div>
    );
  }

  return (
    <div className="quiz-taker">
      <div className="quiz-header">
        <button onClick={onBack} className="btn-back">
          ← Back
        </button>
        <h2>{quiz.title}</h2>
        {timeLeft !== null && (
          <div className="timer">
            Time Left: {Math.floor(timeLeft / 60)}:
            {(timeLeft % 60).toString().padStart(2, "0")}
          </div>
        )}
      </div>

      <div className="questions-container">
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="question-card">
            <h3>
              Question {qIndex + 1}: {q.question}
            </h3>
            <div className="answers-options">
              {q.answers.map((a, aIndex) => (
                <div key={aIndex} className="answer-option">
                  <input
                    type="radio"
                    name={`question-${qIndex}`}
                    checked={answers[qIndex] === aIndex}
                    onChange={() => {
                      const newAnswers = [...answers];
                      newAnswers[qIndex] = aIndex;
                      setAnswers(newAnswers);
                    }}
                  />
                  <label>
                    {String.fromCharCode(65 + aIndex)}. {a.text}
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="submit-container">
        <button onClick={() => handleSubmit(false)} className="btn-primary">
          Submit Quiz
        </button>
      </div>
    </div>
  );
};

const QuizResults = ({ quiz, onBack, getAuthHeaders }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchResults = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/quiz/${quiz.quizId}/leaderboard`,
        { headers: getAuthHeaders() },
      );
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Error fetching results");
    } finally {
      setLoading(false);
    }
  };

  const handleClearLeaderboard = async () => {
    if (!window.confirm("Clear all results for this quiz?")) return;

    try {
      await axios.delete(`${API_URL}/quiz/${quiz.quizId}/leaderboard`, {
        headers: getAuthHeaders(),
      });
      alert("Leaderboard cleared!");
      fetchResults();
    } catch (err) {
      setError(err.response?.data?.message || "Error clearing leaderboard");
    }
  };

  return (
    <div className="quiz-results">
      <div className="results-header">
        <button onClick={onBack} className="btn-back">
          ← Back
        </button>
        <h2>Results: {quiz.title}</h2>
        <button onClick={handleClearLeaderboard} className="btn-delete">
          Clear Leaderboard
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading results...</div>
      ) : results.length === 0 ? (
        <p>No results yet.</p>
      ) : (
        <table className="results-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Student</th>
              <th>Score</th>
              <th>Percentage</th>
              <th>Attempt</th>
              <th>Time Used</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, index) => (
              <tr key={r.id}>
                <td>{index + 1}</td>
                <td>{r.userName}</td>
                <td>
                  {r.score} / {r.total}
                </td>
                <td>{((r.score / r.total) * 100).toFixed(2)}%</td>
                <td>#{r.attempt}</td>
                <td>{r.timeUsed ? `${r.timeUsed}s` : "N/A"}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const MyResults = ({ quiz, onBack, getAuthHeaders }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMyResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMyResults = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/quiz/${quiz.quizId}/my-results`,
        { headers: getAuthHeaders() },
      );
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Error fetching your results");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-results">
      <div className="results-header">
        <button onClick={onBack} className="btn-back">
          ← Back
        </button>
        <h2>My Results: {quiz.title}</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading your results...</div>
      ) : results.length === 0 ? (
        <p>You haven't taken this quiz yet.</p>
      ) : (
        <div className="results-list">
          {results.map((r) => (
            <div key={r._id} className="result-item">
              <h3>Attempt #{r.attempt}</h3>
              <p>
                Score: {r.score} / {r.total} (
                {((r.score / r.total) * 100).toFixed(2)}%)
              </p>
              <p>Time Used: {r.timeUsed ? `${r.timeUsed}s` : "N/A"}</p>
              <p>Date: {new Date(r.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuizDashboard;
