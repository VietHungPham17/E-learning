import React, { useState, useEffect, useRef } from "react";
import webrtcService from "../../services/webrtcService";
import VideoGrid from "./VideoGrid";
import VideoControls from "./VideoControls";
import "./VideoCall.css";

const VideoCall = ({ channel, onClose, currentUser }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);
  const localVideoRef = useRef(null);

  useEffect(() => {
    initializeCall();

    return () => {
      cleanup();
    };
  }, []);

  const initializeCall = async () => {
    try {
      webrtcService.connect("http://localhost:6036");

      webrtcService.onRemoteStream = handleRemoteStream;
      webrtcService.onUserJoined = handleUserJoined;
      webrtcService.onUserLeft = handleUserLeft;
      webrtcService.onUserMediaToggle = handleUserMediaToggle;

      const stream = await webrtcService.joinRoom(
        channel.id,
        currentUser.id,
        currentUser.name || currentUser.fullName || currentUser.username,
      );

      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setParticipants((prev) => [
        {
          id: currentUser.id,
          name:
            currentUser.name || currentUser.fullName || currentUser.username,
          isLocal: true,
          isVideoEnabled: true,
          isAudioEnabled: true,
        },
      ]);
    } catch (err) {
      console.error("Error initializing call:", err);
      setError(
        "Không thể truy cập camera/microphone. Vui lòng kiểm tra quyền truy cập.",
      );
    }
  };

  const handleRemoteStream = (socketId, stream, userInfo) => {
    console.log("Adding remote stream:", socketId, userInfo);
    setRemoteStreams((prev) => {
      const newStreams = new Map(prev);
      newStreams.set(socketId, { stream, userInfo });
      return newStreams;
    });

    setParticipants((prev) => {
      const exists = prev.find((p) => p.socketId === socketId);
      if (!exists) {
        return [
          ...prev,
          {
            id: userInfo.userId,
            socketId: socketId,
            name: userInfo.userName,
            isLocal: false,
            isVideoEnabled: true,
            isAudioEnabled: true,
          },
        ];
      }
      return prev;
    });
  };

  const handleUserJoined = (user) => {
    console.log("User joined:", user);
  };

  const handleUserLeft = (socketId) => {
    console.log("User left:", socketId);
    setRemoteStreams((prev) => {
      const newStreams = new Map(prev);
      newStreams.delete(socketId);
      return newStreams;
    });

    setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
  };

  const handleUserMediaToggle = (socketId, type, enabled) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.socketId === socketId) {
          return {
            ...p,
            [type === "video" ? "isVideoEnabled" : "isAudioEnabled"]: enabled,
          };
        }
        return p;
      }),
    );
  };

  const handleToggleVideo = () => {
    const enabled = webrtcService.toggleVideo();
    setIsVideoEnabled(enabled);
    setParticipants((prev) =>
      prev.map((p) => (p.isLocal ? { ...p, isVideoEnabled: enabled } : p)),
    );
  };

  const handleToggleAudio = () => {
    const enabled = webrtcService.toggleAudio();
    setIsAudioEnabled(enabled);
    setParticipants((prev) =>
      prev.map((p) => (p.isLocal ? { ...p, isAudioEnabled: enabled } : p)),
    );
  };

  const handleShareScreen = async () => {
    try {
      if (isScreenSharing) {
        webrtcService.stopScreenShare();
        setIsScreenSharing(false);
      } else {
        await webrtcService.shareScreen();
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  const handleLeaveCall = () => {
    cleanup();
    onClose();
  };

  const cleanup = () => {
    webrtcService.leaveRoom();
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
  };

  if (error) {
    return (
      <div className="video-call-error">
        <div className="error-message">
          <h3>Lỗi</h3>
          <p>{error}</p>
          <button onClick={onClose}>Đóng</button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-call-container">
      <div className="video-call-header">
        <h3>Video Call - {channel.data?.name || "Group Meeting"}</h3>
        <div className="participants-count">
          {participants.length} người tham gia
        </div>
      </div>

      <VideoGrid
        localStream={localStream}
        remoteStreams={remoteStreams}
        participants={participants}
        currentUserId={currentUser.id}
      />

      <VideoControls
        isVideoEnabled={isVideoEnabled}
        isAudioEnabled={isAudioEnabled}
        isScreenSharing={isScreenSharing}
        onToggleVideo={handleToggleVideo}
        onToggleAudio={handleToggleAudio}
        onShareScreen={handleShareScreen}
        onLeaveCall={handleLeaveCall}
      />
    </div>
  );
};

export default VideoCall;
