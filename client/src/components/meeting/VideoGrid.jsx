import React, { useEffect, useRef } from "react";
import "./VideoGrid.css";

const VideoTile = ({ stream, participant, isLocal }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`video-tile ${isLocal ? "local" : "remote"}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={!participant.isVideoEnabled ? "video-hidden" : ""}
      />
      {!participant.isVideoEnabled && (
        <div className="video-placeholder">
          <div className="avatar-placeholder">
            {participant.name?.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div className="video-info">
        <span className="participant-name">
          {participant.name} {isLocal ? "(Bạn)" : ""}
        </span>
        <div className="media-indicators">
          {!participant.isAudioEnabled && (
            <span className="muted-icon" title="Đã tắt mic">
              🔇
            </span>
          )}
          {!participant.isVideoEnabled && (
            <span className="camera-off-icon" title="Đã tắt camera">
              📷
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const VideoGrid = ({
  localStream,
  remoteStreams,
  participants,
  currentUserId,
}) => {
  const getGridClass = () => {
    const totalParticipants = 1 + remoteStreams.size;
    if (totalParticipants === 1) return "grid-1";
    if (totalParticipants === 2) return "grid-2";
    if (totalParticipants <= 4) return "grid-4";
    if (totalParticipants <= 6) return "grid-6";
    return "grid-9";
  };

  const localParticipant = participants.find((p) => p.isLocal);

  return (
    <div className={`video-grid ${getGridClass()}`}>
      {localStream && localParticipant && (
        <VideoTile
          stream={localStream}
          participant={localParticipant}
          isLocal={true}
        />
      )}

      {Array.from(remoteStreams.entries()).map(
        ([socketId, { stream, userInfo }]) => {
          const participant = participants.find(
            (p) => p.socketId === socketId
          ) || {
            name: userInfo.userName,
            isVideoEnabled: true,
            isAudioEnabled: true,
          };

          return (
            <VideoTile
              key={socketId}
              stream={stream}
              participant={participant}
              isLocal={false}
            />
          );
        }
      )}
    </div>
  );
};

export default VideoGrid;
