import io from "socket.io-client";
import Cookies from "universal-cookie";

const cookies = new Cookies();
const SERVER_URL = process.env.REACT_APP_API_URL || "http://localhost:6036";

// localStorage key tracking which notification IDs this user has read
const STORAGE_KEY = "readNotifIds";

const getReadIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

const saveReadIds = (set) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
};

class NotificationService {
  constructor() {
    this.socket       = null;
    this.onNotification = null; // callback(notif) for real-time events
    this._readIds     = getReadIds();
  }

  connect() {
    if (this.socket?.connected) return;
    const token = cookies.get("accessToken");
    if (!token) return;

    this.socket = io(SERVER_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    this.socket.on("quiz-notification", (notif) => {
      if (this.onNotification) this.onNotification(notif);
    });
  }

  joinChannels(channelIds) {
    if (!this.socket) return;
    channelIds.forEach((id) =>
      this.socket.emit("join-quiz-channel", { channelId: id })
    );
  }

  leaveChannels(channelIds) {
    if (!this.socket) return;
    channelIds.forEach((id) =>
      this.socket.emit("leave-quiz-channel", { channelId: id })
    );
  }

  // Fetch persisted notifications from server for the given channelIds
  async fetchNotifications(channelIds, accessToken) {
    if (!channelIds.length) return [];
    const qs = channelIds.join(",");
    const res = await fetch(
      `${SERVER_URL}/notifications?channelIds=${encodeURIComponent(qs)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((n) => ({ ...n, read: this._readIds.has(n._id) }));
  }

  markRead(notifId) {
    this._readIds.add(notifId);
    saveReadIds(this._readIds);
  }

  markAllRead(notifs) {
    notifs.forEach((n) => this._readIds.add(n._id));
    saveReadIds(this._readIds);
  }

  isRead(notifId) {
    return this._readIds.has(notifId);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export default new NotificationService();
