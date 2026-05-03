import React, { useState, useEffect, useRef } from "react";
import apiClient from "../services/apiClient";
import "./QuizDashboard.css";

const QuizTaker = ({ quiz, onBack }) => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [tabWarning, setTabWarning] = useState(false);

  const sessionIdRef = useRef(null);
  const tabSwitchesRef = useRef(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    beginQuiz();
  }, []);

  // Tab/window visibility change detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !submittedRef.current) {
        tabSwitchesRef.current += 1;
        setTabSwitches(tabSwitchesRef.current);
        setTabWarning(true);
        setTimeout(() => setTabWarning(false), 3000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Server-driven countdown timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          doSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const beginQuiz = async () => {
    try {
      const response = await apiClient.post(`/quiz/${quiz.quizId}/begin`);
      const { sessionId, expiresAt, questions: qs } = response.data;

      sessionIdRef.current = sessionId;
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(-1));

      if (expiresAt) {
        const secondsLeft = Math.max(
          0,
          Math.round((new Date(expiresAt) - Date.now()) / 1000)
        );
        setTimeLeft(secondsLeft);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error starting quiz");
    } finally {
      setLoading(false);
    }
  };

  const doSubmit = async (autoSubmit = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    if (!autoSubmit && answers.some((a) => a === -1)) {
      if (!window.confirm("Bạn chưa trả lời hết câu hỏi. Vẫn nộp bài?")) {
        submittedRef.current = false;
        return;
      }
    }

    try {
      const response = await apiClient.post(`/quiz/${quiz.quizId}/submit`, {
        answers,
        sessionId: sessionIdRef.current,
        tabSwitches: tabSwitchesRef.current,
      });
      setResult(response.data);
      setSubmitted(true);
    } catch (err) {
      submittedRef.current = false;
      setError(err.response?.data?.message || "Error submitting quiz");
    }
  };

  if (loading) return <div className="loading">Loading quiz...</div>;
  if (error) return <div className="error-message">{error}</div>;

  if (submitted && result) {
    return (
      <div className="quiz-result">
        <h2>Hoàn thành bài quiz!</h2>
        <div className="result-summary">
          <p className="score">
            Điểm: {result.score} / {result.total}
          </p>
          <p>Lần làm: #{result.attempt}</p>
          <p>
            Tỉ lệ đúng: {((result.score / result.total) * 100).toFixed(2)}%
          </p>
          {result.timeUsed != null && (
            <p>Thời gian làm bài: {result.timeUsed}s</p>
          )}
          {tabSwitchesRef.current > 0 && (
            <p className="tab-warning-result">
              ⚠️ Chuyển tab / rời khỏi trang: {tabSwitchesRef.current} lần
            </p>
          )}
        </div>
        <div className="result-details">
          <h3>Xem lại đáp án:</h3>
          {result.detail.map((d, index) => (
            <div
              key={index}
              className={`answer-review ${d.ok ? "correct" : "wrong"}`}
            >
              <p>
                Câu {index + 1}: {d.ok ? "✓ Đúng" : "✗ Sai"}
              </p>
              <p>Bạn chọn: {d.your === -1 ? "Bỏ qua" : String.fromCharCode(65 + d.your)}</p>
              {!d.ok && (
                <p className="correct-answer">
                  Đáp án đúng: {String.fromCharCode(65 + d.correct)}
                </p>
              )}
            </div>
          ))}
        </div>
        <button onClick={onBack} className="btn-primary">
          Quay lại danh sách quiz
        </button>
      </div>
    );
  }

  const timerColor =
    timeLeft !== null && timeLeft <= 30 ? "#e74c3c" : undefined;

  return (
    <div className="quiz-taker">
      {tabWarning && (
        <div className="tab-switch-warning">
          ⚠️ Cảnh báo: Bạn đã rời khỏi trang quiz! Lần vi phạm:{" "}
          {tabSwitches}
        </div>
      )}

      <div className="quiz-header">
        <button onClick={onBack} className="btn-back">
          ← Quay lại
        </button>
        <h2>{quiz.title}</h2>
        {timeLeft !== null && (
          <div className="timer" style={{ color: timerColor }}>
            Thời gian còn lại: {Math.floor(timeLeft / 60)}:
            {(timeLeft % 60).toString().padStart(2, "0")}
          </div>
        )}
      </div>

      <div className="questions-container">
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="question-card">
            <h3>
              Câu {qIndex + 1}: {q.question}
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
        <button onClick={() => doSubmit(false)} className="btn-primary">
          Nộp bài
        </button>
      </div>
    </div>
  );
};

export default QuizTaker;
