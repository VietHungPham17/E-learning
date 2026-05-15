import React, { useState, useRef, useEffect } from "react";
import "./NotificationBell.css";

const TYPE_ICON = {
  quiz_created: "📝",
  quiz_started: "🚀",
  message_new:  "💬",
};

const TYPE_LABEL = {
  quiz_created: "Quiz mới",
  quiz_started: "Quiz bắt đầu",
  message_new:  "Tin nhắn",
};

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return "vừa xong";
  if (diff < 3600)  return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
};

const NotificationBell = ({ notifications, onMarkAllRead, onMarkOneRead }) => {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropRef = useRef(null);

  const unread = notifications.filter((n) => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.top, left: rect.right + 8 });
    }
    setOpen((prev) => !prev);
  };

  const handleMarkAll = () => {
    onMarkAllRead();
  };

  return (
    <div className="notif-bell">
      <button
        ref={btnRef}
        className="notif-bell__btn"
        onClick={handleOpen}
        title="Thông báo"
        aria-label={`Thông báo${unread > 0 ? ` (${unread} chưa đọc)` : ""}`}
      >
        🔔
        {unread > 0 && (
          <span className="notif-bell__badge">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropRef}
          className="notif-dropdown"
          style={{ top: dropPos.top, left: dropPos.left }}
        >
          <div className="notif-dropdown__header">
            <span>Thông báo</span>
            {unread > 0 && (
              <button className="notif-dropdown__mark-all" onClick={handleMarkAll}>
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          <div className="notif-dropdown__list">
            {notifications.length === 0 ? (
              <div className="notif-dropdown__empty">Không có thông báo nào</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  className={`notif-item ${n.read ? "notif-item--read" : "notif-item--unread"}`}
                  onClick={() => onMarkOneRead(n._id)}
                >
                  <span className="notif-item__icon">
                    {TYPE_ICON[n.type] || "🔔"}
                  </span>
                  <div className="notif-item__body">
                    <div className="notif-item__title">{n.title}</div>
                    <div className="notif-item__text">{n.body}</div>
                    <div className="notif-item__meta">
                      <span className="notif-item__type">{TYPE_LABEL[n.type] || n.type}</span>
                      <span className="notif-item__time">{timeAgo(n.createdAt)}</span>
                    </div>
                  </div>
                  {!n.read && <span className="notif-item__dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
