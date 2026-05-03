import apiClient from "./apiClient";

export const geminiService = {
  // Generate quiz using Gemini API
  async generateQuiz({ topics, questionCount, difficulty }) {
    try {
      console.log("[GEMINI SERVICE] Generating quiz:", {
        topics,
        questionCount,
        difficulty,
      });

      // Validate input before sending
      if (!topics || !Array.isArray(topics) || topics.length === 0) {
        throw new Error("Please select at least one topic");
      }

      if (!questionCount || questionCount < 1 || questionCount > 50) {
        throw new Error("Question count must be between 1 and 50");
      }

      if (!difficulty) {
        throw new Error("Please select a difficulty level");
      }

      const response = await apiClient.post(
        "/quiz/generate-ai",
        {
          topics,
          questionCount: parseInt(questionCount),
          difficulty,
        },
        { timeout: 45000 },
      );

      console.log("[GEMINI SERVICE] Quiz generated successfully:", {
        questionCount: response.data.questions?.length,
        title: response.data.title,
      });

      return response.data;
    } catch (error) {
      console.error("[GEMINI SERVICE] Error generating quiz:", error);

      // Handle specific error cases
      if (error.response) {
        // Server responded with error status
        const message = error.response.data?.message || "Error generating quiz";
        const status = error.response.status;

        if (status === 400) {
          throw new Error(`Invalid request: ${message}`);
        } else if (status === 401) {
          throw new Error("Authentication required. Please login again.");
        } else if (status === 403) {
          throw new Error(
            "Invalid API key. Please check server configuration.",
          );
        } else if (status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.");
        } else if (status === 500) {
          throw new Error(`Server error: ${message}`);
        } else if (status === 504) {
          throw new Error(
            "Request timed out. Please try again with fewer questions.",
          );
        }

        throw new Error(message);
      } else if (error.request) {
        // Request was made but no response received
        throw new Error(
          "No response from server. Please check your connection.",
        );
      } else if (error.code === "ECONNABORTED") {
        // Timeout error
        throw new Error(
          "Request timed out. Please try again with fewer questions.",
        );
      } else {
        // Other errors
        throw new Error(error.message || "Unknown error occurred");
      }
    }
  },

  // Save generated quiz to database
  async saveGeneratedQuiz(quizData) {
    try {
      console.log("[GEMINI SERVICE] Saving quiz:", {
        quizId: quizData.quizId,
        title: quizData.title,
        questionCount: quizData.questions?.length,
      });

      // Validate quiz data before sending
      if (!quizData.quizId || !quizData.title || !quizData.channelId) {
        throw new Error("Quiz ID, title, and channel ID are required");
      }

      if (
        !quizData.questions ||
        !Array.isArray(quizData.questions) ||
        quizData.questions.length === 0
      ) {
        throw new Error("Quiz must have at least one question");
      }

      const response = await apiClient.post(
        "/quiz/save-generated",
        quizData,
        { timeout: 30000 },
      );

      console.log("[GEMINI SERVICE] Quiz saved successfully:", {
        quizId: response.data.quiz?.quizId,
        questionsCount: response.data.questionsCount,
      });

      return response.data;
    } catch (error) {
      console.error("[GEMINI SERVICE] Error saving quiz:", error);

      // Handle specific error cases
      if (error.response) {
        const message = error.response.data?.message || "Error saving quiz";
        const status = error.response.status;

        if (status === 400) {
          if (message.includes("already exists")) {
            throw new Error(
              "Quiz ID already exists. Please try generating again.",
            );
          }
          throw new Error(`Invalid data: ${message}`);
        } else if (status === 401) {
          throw new Error("Authentication required. Please login again.");
        } else if (status === 500) {
          throw new Error(`Server error: ${message}`);
        }

        throw new Error(message);
      } else if (error.request) {
        throw new Error(
          "No response from server. Please check your connection.",
        );
      } else if (error.code === "ECONNABORTED") {
        throw new Error("Request timed out. Please try again.");
      } else {
        throw new Error(error.message || "Unknown error occurred");
      }
    }
  },
};

export default geminiService;
