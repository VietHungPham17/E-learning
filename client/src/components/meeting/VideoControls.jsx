import React from "react";
import "./VideoControls.css";

const VideoControls = ({
  isVideoEnabled,
  isAudioEnabled,
  isScreenSharing,
  onToggleVideo,
  onToggleAudio,
  onShareScreen,
  onLeaveCall,
}) => {
  return (
    <div className="video-controls">
      <div className="controls-group">
        <button
          className={`control-btn ${!isAudioEnabled ? "disabled" : ""}`}
          onClick={onToggleAudio}
          title={isAudioEnabled ? "Tắt mic" : "Bật mic"}
        >
          <span className="control-icon">{isAudioEnabled ? "🎤" : "🔇"}</span>
          <span className="control-label">
            {isAudioEnabled ? "Mic" : "Tắt mic"}
          </span>
        </button>

        <button
          className={`control-btn ${!isVideoEnabled ? "disabled" : ""}`}
          onClick={onToggleVideo}
          title={isVideoEnabled ? "Tắt camera" : "Bật camera"}
        >
          <span className="control-icon">{isVideoEnabled ? "📹" : "📷"}</span>
          <span className="control-label">
            {isVideoEnabled ? "Camera" : "Tắt camera"}
          </span>
        </button>

        <button
          className={`control-btn ${isScreenSharing ? "active" : ""}`}
          onClick={onShareScreen}
          title={isScreenSharing ? "Dừng chia sẻ" : "Chia sẻ màn hình"}
        >
          <span className="control-icon">🖥️</span>
          <span className="control-label">
            {isScreenSharing ? "Đang chia sẻ" : "Chia sẻ"}
          </span>
        </button>

        <button
          className="control-btn leave-btn"
          onClick={onLeaveCall}
          title="Rời khỏi cuộc gọi"
        >
          <span className="control-icon">📞</span>
          <span className="control-label">Rời khỏi</span>
        </button>
      </div>
    </div>
  );
};

export default VideoControls;
