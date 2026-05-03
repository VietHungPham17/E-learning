import React, { useState } from "react";
import "./QuizGenerator.css";

const QuizGenerator = ({ onClose, onGenerate }) => {
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("Beginner");
  const [isGenerating, setIsGenerating] = useState(false);

  const topics = [
    "Web Development",
    "Frontend",
    "Backend",
    "Software Engineering",
    "Database Systems",
    "Cloud Computing",
    "DevOps & CI/CD",
    "Mobile Development",
    "Information Security",
    "System Design",
    "Data Science",
    "Artificial Intelligence",
    "Machine Learning",
    "Blockchain",
    "Operating Systems",
    "Cybersecurity",
    "Internet of Things",
    "Computer Networks",
  ];

  const questionOptions = [5, 10, 20, 30, 40, 50];
  const difficultyOptions = [
    "Beginner",
    "Easy",
    "Medium",
    "Intermediate",
    "Hard",
    "Expert",
  ];

  const toggleTopic = (topic) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const selectAllTopics = () => {
    setSelectedTopics(topics);
  };

  const randomizeSelection = () => {
    const randomCount = Math.floor(Math.random() * 5) + 1;
    const shuffled = [...topics].sort(() => 0.5 - Math.random());
    setSelectedTopics(shuffled.slice(0, randomCount));

    const randomQuestions =
      questionOptions[Math.floor(Math.random() * questionOptions.length)];
    setQuestionCount(randomQuestions);

    const randomDifficulty =
      difficultyOptions[Math.floor(Math.random() * difficultyOptions.length)];
    setDifficulty(randomDifficulty);
  };

  const handleGenerate = async () => {
    if (selectedTopics.length === 0) {
      alert("Please select at least one topic");
      return;
    }

    setIsGenerating(true);
    try {
      await onGenerate({
        topics: selectedTopics,
        questionCount,
        difficulty,
      });
    } catch (error) {
      console.error("Error generating quiz:", error);
      alert("Failed to generate quiz. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="quiz-generator-overlay">
      <div className="quiz-generator-container">
        {/* Header */}
        <header className="quiz-generator-header">
          <div className="header-left">
            <div className="app-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect
                  width="32"
                  height="32"
                  rx="8"
                  fill="white"
                  fillOpacity="0.2"
                />
                <path d="M16 8L20 12H12L16 8Z" fill="white" />
                <path d="M16 24L12 20H20L16 24Z" fill="white" />
                <circle cx="16" cy="16" r="3" fill="white" />
              </svg>
            </div>
            <span className="app-title">IT Master AI</span>
          </div>
          <nav className="header-nav">
            <a href="#features">Features</a>
            <a href="#contact">Contact</a>
          </nav>
          <button className="close-btn" onClick={onClose}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Main Content */}
        <main className="quiz-generator-main">
          <div className="main-content-wrapper">
            {/* Left Column - Topics */}
            <div className="topics-section">
              <div className="section-card">
                <div className="card-header">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                  <h2>Topics</h2>
                </div>

                <div className="topics-grid">
                  {topics.map((topic) => (
                    <button
                      key={topic}
                      className={`topic-btn ${
                        selectedTopics.includes(topic) ? "active" : ""
                      }`}
                      onClick={() => toggleTopic(topic)}
                    >
                      {topic}
                    </button>
                  ))}
                </div>

                <div className="topics-controls">
                  <button className="control-btn" onClick={selectAllTopics}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                    All
                  </button>
                  <button className="control-btn" onClick={randomizeSelection}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                    </svg>
                    Random
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Settings */}
            <div className="settings-section">
              {/* Questions */}
              <div className="section-card">
                <div className="card-header">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <h2>Questions</h2>
                </div>

                <div className="options-grid">
                  {questionOptions.map((count) => (
                    <button
                      key={count}
                      className={`option-btn ${
                        questionCount === count ? "selected" : ""
                      }`}
                      onClick={() => setQuestionCount(count)}
                    >
                      {String(count).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="section-card">
                <div className="card-header">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  <h2>Difficulty</h2>
                </div>

                <div className="difficulty-options">
                  {difficultyOptions.map((level) => (
                    <button
                      key={level}
                      className={`difficulty-btn ${
                        difficulty === level ? "selected" : ""
                      }`}
                      onClick={() => setDifficulty(level)}
                    >
                      <span className="difficulty-indicator"></span>
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              className="action-btn randomize-btn"
              onClick={randomizeSelection}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
              </svg>
              Randomize Test
            </button>
            <button
              className="action-btn generate-btn"
              onClick={handleGenerate}
              disabled={isGenerating || selectedTopics.length === 0}
            >
              {isGenerating ? (
                <>
                  <div className="spinner"></div>
                  Generating...
                </>
              ) : (
                <>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Generate Test
                </>
              )}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default QuizGenerator;
