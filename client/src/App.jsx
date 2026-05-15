import React, { useState, useEffect, useCallback } from "react";
import { StreamChat } from "stream-chat";
import { Chat } from "stream-chat-react";
import Cookies from "universal-cookie";
import axios from "axios";
import notificationService from "./services/notificationService";

import {
  ChannelListContainer,
  ChannelContainer,
  Auth,
  AdminChannelManager,
  Profile,
} from "./components";
import QuizDashboard from "./components/QuizDashboard";

import "stream-chat-react/dist/css/index.css";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:6036";

const cookies = new Cookies();
const apikey  = process.env.REACT_APP_STREAM_API_KEY;

// Module-level — tồn tại xuyên suốt Strict Mode double-invoke.
// connectPromise được dùng chung giữa mount 1 và mount 2 để tránh
// gọi connectUser() hai lần cùng lúc (sẽ lỗi hoặc treo).
const chatClient   = StreamChat.getInstance(apikey);
let connectPromise = null;

// Xoá toàn bộ cookies phiên đăng nhập
const clearSession = () => {
  [
    "token", "accessToken", "refreshToken",
    "userId", "username", "fullName",
    "avatarURL", "phoneNumber", "role", "2faEnabled",
  ].forEach((k) => cookies.remove(k, { path: "/" }));
};

const App = () => {
  // Nếu chatClient đã connected (VD: HMR reload), khởi đầu là true luôn
  const [isConnected,  setIsConnected]  = useState(!!chatClient.userID);
  const [connectError, setConnectError] = useState("");
  const [userRole,     setUserRole]     = useState("student"); // không tin cookie, chờ server xác nhận

  const [createType,        setCreateType]        = useState("");
  const [isCreating,        setIsCreating]        = useState(false);
  const [isEditing,         setIsEditing]         = useState(false);
  const [viewMode,          setViewMode]          = useState("chat");
  const [activeAdminTab,    setActiveAdminTab]    = useState("users");
  const [activeProfileTab,  setActiveProfileTab]  = useState("info");
  const [isQuizMode,        setIsQuizMode]        = useState(false);
  const [isCollapsed,       setIsCollapsed]       = useState(false);
  const [notifications,     setNotifications]     = useState([]);

  const authToken = cookies.get("token");

  // Xác nhận role từ server mỗi khi kết nối xong — không bao giờ tin cookie
  useEffect(() => {
    if (!isConnected) return;
    const accessToken = cookies.get("accessToken");
    if (!accessToken) return;
    axios.get(`${API_URL}/api/verify`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(({ data }) => {
      if (data?.data?.role) {
        setUserRole(data.data.role);
        cookies.set("role", data.data.role, { path: "/" });
      }
    }).catch(() => { /* giữ nguyên "student" nếu verify thất bại */ });
  }, [isConnected]);

  // Notification callbacks (stable refs)
  const addNotif = useCallback((notif) => {
    setNotifications((prev) => {
      if (prev.some((n) => n._id === notif._id)) return prev;
      return [{ ...notif, read: notificationService.isRead(notif._id) }, ...prev].slice(0, 50);
    });
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      notificationService.markAllRead(updated);
      return updated;
    });
  }, []);

  const handleMarkOneRead = useCallback((id) => {
    notificationService.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n))
    );
  }, []);

  // Connect notification service and fetch history when authenticated
  useEffect(() => {
    if (!isConnected) return;
    const accessToken = cookies.get("accessToken");
    if (!accessToken) return;

    notificationService.connect();
    notificationService.onNotification = addNotif;

    // Query user's channels from Stream Chat then join quiz rooms + fetch history
    chatClient.queryChannels(
      { members: { $in: [chatClient.userID] } },
      {},
      { limit: 30 }
    ).then((channels) => {
      const channelIds = channels.map((c) => c.id).filter(Boolean);
      notificationService.joinChannels(channelIds);
      return notificationService.fetchNotifications(channelIds, accessToken);
    }).then((fetched) => {
      if (fetched.length > 0) setNotifications(fetched);
    }).catch(() => {});

    // Stream Chat: new message in a channel not currently active
    const handleStreamMessage = (event) => {
      if (!event?.message?.id) return;
      const notif = {
        _id: `msg-${event.message.id}`,
        type: "message_new",
        title: `Tin nhắn mới trong #${event.channel?.name || event.channel_id || "channel"}`,
        body: event.message?.text?.slice(0, 100) || "(Tệp đính kèm)",
        channelId: event.channel_id,
        createdAt: new Date().toISOString(),
        read: false,
      };
      addNotif(notif);
    };

    chatClient.on("notification.message_new", handleStreamMessage);

    return () => {
      chatClient.off("notification.message_new", handleStreamMessage);
      notificationService.onNotification = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, addNotif]);

  useEffect(() => {
    // Đã connected hoặc chưa đăng nhập → không làm gì
    if (!authToken || chatClient.userID) return;

    let cancelled  = false;
    let timeoutId  = null;

    // Kiểm tra cookies cần thiết — nếu thiếu thì yêu cầu đăng nhập lại
    const userId = cookies.get("userId");
    if (!userId) {
      setConnectError("Phiên đăng nhập đã hết hạn. Vui lòng đăng xuất và đăng nhập lại.");
      return;
    }

    // Tạo promise MỘT LẦN — nếu Strict Mode chạy effect lần 2 thì
    // dùng lại promise cũ thay vì gọi connectUser() lần nữa.
    if (!connectPromise) {
      const fullName = cookies.get("fullName");
      const username = cookies.get("username");

      connectPromise = chatClient.connectUser(
        {
          id:          userId,
          name:        fullName || username,
          username,
          fullName,
          image:       cookies.get("avatarURL"),
          phoneNumber: cookies.get("phoneNumber"),
          role:        cookies.get("role") || "student",
        },
        authToken
      );
    }

    // Timeout 15 giây — hiện lỗi nếu connectUser bị treo
    timeoutId = setTimeout(() => {
      if (!cancelled) {
        setConnectError(
          "Kết nối bị quá hạn. Vui lòng thử tải lại trang hoặc đăng xuất rồi đăng nhập lại."
        );
      }
    }, 15000);

    connectPromise
      .then(async () => {
        clearTimeout(timeoutId);
        connectPromise = null;
        if (cancelled) return;

        setIsConnected(true); // useEffect verify role sẽ chạy tự động
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        connectPromise = null;
        if (cancelled) return;
        console.error("[Chat] connectUser failed:", err);
        setConnectError(
          "Không thể kết nối Stream. Vui lòng thử tải lại trang hoặc đăng xuất rồi đăng nhập lại."
        );
      });

    // Cleanup: đánh dấu cancelled + xoá timeout — KHÔNG disconnect singleton
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // chạy 1 lần khi mount

  if (!authToken) return <Auth />;

  if (!isConnected) {
    const btnStyle = {
      padding: "8px 20px",
      cursor: "pointer",
      borderRadius: 6,
      border: "none",
      color: "#fff",
      fontSize: 14,
      margin: "4px",
    };

    return (
      <div className="app__connecting">
        {connectError ? (
          <>
            <p style={{ color: "#e74c3c", marginBottom: 12 }}>{connectError}</p>
            <button
              onClick={() => window.location.reload()}
              style={{ ...btnStyle, background: "#005fff" }}
            >
              Tải lại trang
            </button>
            <button
              onClick={() => { clearSession(); window.location.reload(); }}
              style={{ ...btnStyle, background: "#e74c3c" }}
            >
              Đăng xuất
            </button>
          </>
        ) : (
          <p>Đang kết nối...</p>
        )}
      </div>
    );
  }

  return (
    <div className="app__wrapper">
      <Chat client={chatClient} theme="team light">
        <ChannelListContainer
          isCreating={isCreating}
          setIsCreating={setIsCreating}
          setCreateType={setCreateType}
          setIsEditing={setIsEditing}
          viewMode={viewMode}
          setViewMode={setViewMode}
          userRole={userRole}
          activeAdminTab={activeAdminTab}
          setActiveAdminTab={setActiveAdminTab}
          activeProfileTab={activeProfileTab}
          setActiveProfileTab={setActiveProfileTab}
          isQuizMode={isQuizMode}
          setIsQuizMode={setIsQuizMode}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
          onMarkOneRead={handleMarkOneRead}
        />
        {viewMode === "chat" ? (
          <ChannelContainer
            isCreating={isCreating}
            setIsCreating={setIsCreating}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            createType={createType}
            userRole={userRole}
            isQuizMode={isQuizMode}
            isCollapsed={isCollapsed}
          />
        ) : viewMode === "admin" ? (
          <div className={`channel__container${isCollapsed ? " collapsed" : ""}`}>
            <AdminChannelManager
              activeAdminTab={activeAdminTab}
              isCollapsed={isCollapsed}
            />
          </div>
        ) : viewMode === "profile" ? (
          <div className={`channel__container${isCollapsed ? " collapsed" : ""}`}>
            <Profile
              activeProfileTab={activeProfileTab}
              onBack={() => setViewMode("chat")}
              isCollapsed={isCollapsed}
            />
          </div>
        ) : viewMode === "quiz" ? (
          <div className={`channel__container${isCollapsed ? " collapsed" : ""}`}>
            <QuizDashboard userRole={userRole} isCollapsed={isCollapsed} />
          </div>
        ) : null}
      </Chat>
    </div>
  );
};

export default App;
