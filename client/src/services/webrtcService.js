import io from "socket.io-client";
import Cookies from "universal-cookie";

const cookies = new Cookies();

class WebRTCService {
  constructor() {
    this.socket = null;
    this.peers = new Map(); // socketId -> RTCPeerConnection
    this.localStream = null;
    this.roomId = null;
    this.userId = null;
    this.userName = null;

    // Callbacks
    this.onRemoteStream = null;
    this.onUserJoined = null;
    this.onUserLeft = null;
    this.onUserMediaToggle = null;
    this.onIncomingCall = null;
    this.onCallEnded = null;

    // ICE servers configuration (using free STUN servers)
    this.iceServers = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    };
  }

  // Initialize socket connection
  connect(serverUrl = "http://localhost:6036") {
    if (this.socket) return;

    this.socket = io(serverUrl, {
      auth: { token: cookies.get("accessToken") },
    });
    this.setupSocketListeners();
  }

  // Setup socket event listeners
  setupSocketListeners() {
    this.socket.on("existing-users", (users) => {
      console.log("Existing users in room:", users);
      users.forEach((user) => {
        this.createPeerConnection(user.socketId, true, user);
      });
    });

    this.socket.on("user-joined", (user) => {
      console.log("User joined:", user);
      if (this.onUserJoined) {
        this.onUserJoined(user);
      }
    });

    this.socket.on("offer", async ({ offer, from, userId, userName }) => {
      console.log("Received offer from:", from);
      const peer = this.createPeerConnection(from, false, { userId, userName });
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      this.socket.emit("answer", { answer, to: from });
    });

    this.socket.on("answer", async ({ answer, from }) => {
      console.log("Received answer from:", from);
      const peer = this.peers.get(from);
      if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    this.socket.on("ice-candidate", async ({ candidate, from }) => {
      const peer = this.peers.get(from);
      if (peer && candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    this.socket.on("user-left", ({ socketId }) => {
      console.log("User left:", socketId);
      this.removePeer(socketId);
      if (this.onUserLeft) {
        this.onUserLeft(socketId);
      }
    });

    this.socket.on("user-media-toggle", ({ socketId, type, enabled }) => {
      if (this.onUserMediaToggle) {
        this.onUserMediaToggle(socketId, type, enabled);
      }
    });

    this.socket.on("incoming-call", ({ channelId, callerId, callerName }) => {
      if (this.onIncomingCall) {
        this.onIncomingCall({ channelId, callerId, callerName });
      }
    });

    this.socket.on("call-ended", ({ channelId }) => {
      if (this.onCallEnded) {
        this.onCallEnded({ channelId });
      }
    });
  }

  // Join notification room for a channel (to receive incoming-call events)
  joinChannelNotifications(channelId, userId, userName) {
    if (!this.socket) return;
    this.socket.emit("join-channel-notifications", { channelId, userId, userName });
  }

  // Leave notification room when switching away from a channel
  leaveChannelNotifications(channelId) {
    if (!this.socket) return;
    this.socket.emit("leave-channel-notifications", { channelId });
  }

  // Emit call-started so other channel members are notified
  notifyCallStarted(channelId, callerId, callerName) {
    if (!this.socket) return;
    this.socket.emit("call-started", { channelId, callerId, callerName });
  }

  // Create peer connection
  createPeerConnection(socketId, isInitiator, userInfo = {}) {
    if (this.peers.has(socketId)) {
      return this.peers.get(socketId);
    }

    const peer = new RTCPeerConnection(this.iceServers);
    this.peers.set(socketId, peer);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        peer.addTrack(track, this.localStream);
      });
    }

    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: socketId,
        });
      }
    };

    // Handle remote stream
    peer.ontrack = (event) => {
      console.log("Received remote track from:", socketId);
      if (this.onRemoteStream) {
        this.onRemoteStream(socketId, event.streams[0], userInfo);
      }
    };

    // Handle connection state changes
    peer.onconnectionstatechange = () => {
      console.log(`Connection state for ${socketId}:`, peer.connectionState);
      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "disconnected"
      ) {
        this.removePeer(socketId);
      }
    };

    // If initiator, create and send offer
    if (isInitiator) {
      this.createOffer(peer, socketId);
    }

    return peer;
  }

  // Create and send offer
  async createOffer(peer, socketId) {
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      this.socket.emit("offer", { offer, to: socketId });
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  }

  // Remove peer connection
  removePeer(socketId) {
    const peer = this.peers.get(socketId);
    if (peer) {
      peer.close();
      this.peers.delete(socketId);
    }
  }

  // Join a room
  async joinRoom(
    roomId,
    userId,
    userName,
    mediaConstraints = { video: true, audio: true },
  ) {
    this.roomId = roomId;
    this.userId = userId;
    this.userName = userName;

    try {
      // Get local media stream
      this.localStream =
        await navigator.mediaDevices.getUserMedia(mediaConstraints);

      // Join room via socket
      this.socket.emit("join-room", { roomId, userId, userName });

      return this.localStream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      throw error;
    }
  }

  // Leave room and cleanup
  leaveRoom() {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close all peer connections
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();

    // Notify server
    if (this.socket) {
      this.socket.emit("leave-room");
    }

    this.roomId = null;
    this.userId = null;
    this.userName = null;
  }

  // Toggle video
  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.socket.emit("toggle-media", {
          type: "video",
          enabled: videoTrack.enabled,
        });
        return videoTrack.enabled;
      }
    }
    return false;
  }

  // Toggle audio
  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.socket.emit("toggle-media", {
          type: "audio",
          enabled: audioTrack.enabled,
        });
        return audioTrack.enabled;
      }
    }
    return false;
  }

  // Share screen
  async shareScreen() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track in all peer connections
      this.peers.forEach((peer) => {
        const sender = peer.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      // When screen sharing stops, revert to camera
      screenTrack.onended = () => {
        const videoTrack = this.localStream.getVideoTracks()[0];
        this.peers.forEach((peer) => {
          const sender = peer
            .getSenders()
            .find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
      };

      return screenStream;
    } catch (error) {
      console.error("Error sharing screen:", error);
      throw error;
    }
  }

  // Stop screen sharing
  stopScreenShare() {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    if (videoTrack) {
      this.peers.forEach((peer) => {
        const sender = peer.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
    }
  }

  // Disconnect
  disconnect() {
    this.leaveRoom();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

const webrtcService = new WebRTCService();
export default webrtcService;
