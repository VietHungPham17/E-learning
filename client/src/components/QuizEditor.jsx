import React, { useState, useEffect } from "react";
import apiClient from "../services/apiClient";
import "./QuizDashboard.css";

const QuizEditor = ({ quiz, onBack, channel }) => {
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
      const response = await apiClient.get(
        `/quiz/${quiz.quizId}/questions/full`,
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
        await apiClient.put(
          `/quiz/${quiz.quizId}/questions/${editingQuestion._id}`,
          questionForm,
        );
        alert("Question updated!");
      } else {
        await apiClient.post(
          `/quiz/${quiz.quizId}/questions`,
          questionForm,
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
      await apiClient.delete(
        `/quiz/${quiz.quizId}/questions/${questionId}`,
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
        {channel && <p>Channel: {channel.data?.name || channel.id}</p>}
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
};

export default QuizEditor;
