import React, { useState } from "react";
import "./QuizMaker.css";

const QuizMaker = ({ onBack, onGenerate }) => {
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
    "Computer Networks",
    "Operating Systems",
    "Cybersecurity",
    "System Design",
    "Data Science",
    "Artificial Intelligence",
    "Machine Learning",
    "Blockchain",
    "Internet of Things",
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
    if (selectedTopics.length === topics.length) {
      setSelectedTopics([]);
    } else {
      setSelectedTopics(topics);
    }
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
    <div className="quiz-maker-container">
      <div className="quiz-maker-header">
        <button onClick={onBack} className="btn-back">
          ← Back to Quizzes
        </button>
        <h2>Create New Quiz</h2>
      </div>

      <div className="quiz-maker-content">
        <div className="quiz-maker-left">
          <div className="section-header">
            <div className="section-icon">📚</div>
            <h3>Topics</h3>
          </div>

          <div className="control-buttons">
            <button
              className={`control-btn ${
                selectedTopics.length === topics.length ? "active" : ""
              }`}
              onClick={selectAllTopics}
            >
              <span className="btn-icon">⊞</span> All
            </button>
            <button className="control-btn" onClick={randomizeSelection}>
              <span className="btn-icon">🎲</span> Random
            </button>
          </div>

          <div className="topics-grid">
            {topics.map((topic) => (
              <button
                key={topic}
                className={`topic-btn ${
                  selectedTopics.includes(topic) ? "selected" : ""
                }`}
                onClick={() => toggleTopic(topic)}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        <div className="quiz-maker-right">
          <div className="section questions-section">
            <div className="section-header">
              <div className="section-icon">❓</div>
              <h3>Questions</h3>
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
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="section difficulty-section">
            <div className="section-header">
              <div className="section-icon">⚙️</div>
              <h3>Difficulty</h3>
            </div>
            <div className="options-grid">
              {difficultyOptions.map((level) => (
                <button
                  key={level}
                  className={`option-btn ${
                    difficulty === level ? "selected" : ""
                  }`}
                  onClick={() => setDifficulty(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="quiz-maker-footer">
        <button
          className="btn-randomize"
          onClick={randomizeSelection}
          disabled={isGenerating}
        >
          <span className="btn-icon">🎲</span>
          Randomize Test
        </button>
        <button
          className="btn-generate"
          onClick={handleGenerate}
          disabled={isGenerating || selectedTopics.length === 0}
        >
          <span className="btn-icon">▶</span>
          {isGenerating ? "Generating..." : "Generate Test"}
        </button>
      </div>
    </div>
  );
};

export default QuizMaker;
