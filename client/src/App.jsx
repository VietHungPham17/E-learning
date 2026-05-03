import React, { useState, useEffect } from "react";
import { StreamChat } from "stream-chat";
import { Chat } from "stream-chat-react";
import Cookies from "universal-cookie";
import axios from "axios";

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
  const [userRole,     setUserRole]     = useState(cookies.get("role") || "student");

  const [createType,        setCreateType]        = useState("");
  const [isCreating,        setIsCreating]        = useState(false);
  const [isEditing,         setIsEditing]         = useState(false);
  const [viewMode,          setViewMode]          = useState("chat");
  const [activeAdminTab,    setActiveAdminTab]    = useState("users");
  const [activeProfileTab,  setActiveProfileTab]  = useState("info");
  const [isQuizMode,        setIsQuizMode]        = useState(false);
  const [isCollapsed,       setIsCollapsed]       = useState(false);

  const authToken = cookies.get("token");

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

        setIsConnected(true);

        // Đồng bộ role thật từ server (non-fatal).
        // Dùng axios trực tiếp — KHÔNG dùng apiClient để tránh interceptor
        // tự động reload trang khi accessToken/refreshToken đã hết hạn.
        try {
          const accessToken = cookies.get("accessToken");
          if (accessToken) {
            const { data } = await axios.get(`${API_URL}/api/verify`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!cancelled && data?.data?.role) {
              setUserRole(data.data.role);
              cookies.set("role", data.data.role);
            }
          }
        } catch { /* fallback về role trong cookie */ }
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
