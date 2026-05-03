import React, { useState, useEffect } from "react";
import apiClient from "../services/apiClient";
import "./QuizDashboard.css";

const MyResults = ({ quiz, onBack }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMyResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMyResults = async () => {
    try {
      const response = await apiClient.get(
        `/quiz/${quiz.quizId}/my-results`,
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

export default MyResults;
