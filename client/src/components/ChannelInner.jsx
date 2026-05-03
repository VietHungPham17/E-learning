import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  MessageList,
  MessageInput,
  Thread,
  Window,
  useChannelActionContext,
  Avatar,
  useChannelStateContext,
  useChatContext,
  useMessageContext,
  MessageSimple,
} from "stream-chat-react";
import Cookies from "universal-cookie";

import { ChannelInfo } from "../assets";
import VideoCall from "./meeting/VideoCall";
import { CryptoContext } from "../context/CryptoContext";
import { encryptText, decryptText, encryptFile } from "../services/cryptoService";
import webrtcService from "../services/webrtcService";

const cookies = new Cookies();

export const GiphyContext = React.createContext({});

// ── File validation ───────────────────────────────────────────────────────────

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE  = 25 * 1024 * 1024; // 25 MB

const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "scr", "msi", "dll", "sys",
  "vbs", "vbe", "js", "jse", "ws", "wsf", "wsh", "ps1", "ps2",
  "sh", "bash", "zsh", "fish",
  "php", "php3", "php4", "php5", "phtml",
  "py", "rb", "pl", "cgi", "asp", "aspx", "jsp",
  "jar", "class", "apk", "dex",
  "dmg", "pkg", "app", "ipa",
  "pif", "reg", "hta", "cpl", "inf", "lnk", "gadget",
]);

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif",
  "image/webp", "image/svg+xml", "image/bmp", "image/avif",
]);

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv",
  "application/zip", "application/x-zip-compressed",
  // images are also valid file uploads
  ...ALLOWED_IMAGE_TYPES,
]);

function validateFile(file, isImage = false) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new Error(`Loại file .${ext} không được phép tải lên`);
  }

  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
  if (file.size > maxSize) {
    const mb = maxSize / (1024 * 1024);
    throw new Error(`File vượt quá giới hạn ${mb}MB`);
  }

  const allowed = isImage ? ALLOWED_IMAGE_TYPES : ALLOWED_FILE_TYPES;
  if (file.type && !allowed.has(file.type)) {
    throw new Error(`Loại file không được hỗ trợ: ${file.type || ext}`);
  }
}

// ── Custom Message component — decrypts text before rendering ─────────────────
// In stream-chat-react v6 the message object lives in MessageContext, not props.

const EncryptedMessage = (props) => {
  const { channelCryptoKey } = useContext(CryptoContext);
  const { message } = useMessageContext();
  const rawText = message?.text ?? "";
  const [displayText, setDisplayText] = useState(rawText);

  useEffect(() => {
    let cancelled = false;

    if (channelCryptoKey && rawText.startsWith("ENC:")) {
      decryptText(channelCryptoKey, rawText).then((decrypted) => {
        if (!cancelled) setDisplayText(decrypted);
      });
    } else {
      setDisplayText(rawText);
    }

    return () => { cancelled = true; };
  }, [rawText, channelCryptoKey]);

  return <MessageSimple {...props} message={{ ...message, text: displayText }} />;
};

// ── ChannelInner ─────────────────────────────────────────────────────────────

const SOCKET_URL = process.env.REACT_APP_API_URL || "http://localhost:6036";

const ChannelInner = ({ setIsEditing }) => {
  const [giphyState, setGiphyState]       = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [isMeetingOngoing, setIsMeetingOngoing] = useState(false);
  const [incomingCall, setIncomingCall]   = useState(null); // { callerId, callerName }

  const { sendMessage }  = useChannelActionContext();
  const { channel }      = useChannelStateContext();
  const { client }       = useChatContext();
  const { channelCryptoKey, keyError } = useContext(CryptoContext);

  // Connect socket và đăng ký nhận thông báo cuộc gọi cho channel hiện tại
  useEffect(() => {
    if (!channel?.id || !client?.user?.id) return;

    const channelId = channel.id;
    const userId    = client.user.id;
    const userName  = client.user.fullName || client.user.name || client.user.id;

    webrtcService.connect(SOCKET_URL);
    webrtcService.joinChannelNotifications(channelId, userId, userName);

    webrtcService.onIncomingCall = ({ channelId: cid, callerId, callerName }) => {
      // Không hiển thị nếu chính mình là người gọi hoặc đang trong cuộc gọi
      if (cid === channelId && callerId !== userId) {
        setIncomingCall({ callerId, callerName });
      }
    };

    webrtcService.onCallEnded = ({ channelId: cid }) => {
      if (cid === channelId) setIncomingCall(null);
    };

    return () => {
      webrtcService.leaveChannelNotifications(channelId);
      webrtcService.onIncomingCall = null;
      webrtcService.onCallEnded    = null;
    };
  }, [channel?.id, client?.user?.id]);

  // Encrypt text before sending to Stream
  const overrideSubmitHandler = useCallback(
    async (message) => {
      let text = message.text;

      if (channelCryptoKey && text) {
        try {
          text = await encryptText(channelCryptoKey, text);
        } catch (err) {
          console.error("[CRYPTO] encryptText failed:", err);
        }
      }

      if (sendMessage) {
        sendMessage({
          attachments:    message.attachments,
          mentioned_users: message.mentioned_users,
          parent_id:      message.parent?.id,
          parent:         message.parent,
          text:           giphyState ? `/giphy ${text}` : text,
        });
        setGiphyState(false);
      }
    },
    [channelCryptoKey, giphyState, sendMessage]
  );

  // Encrypt file before uploading to Stream
  const doFileUploadRequest = useCallback(
    async (file, ch) => {
      validateFile(file, false); // throws on invalid type/size
      const toUpload = channelCryptoKey ? await encryptFile(channelCryptoKey, file) : file;
      const { file: url } = await ch.sendFile(toUpload);
      return { file: url };
    },
    [channelCryptoKey]
  );

  // Encrypt image before uploading to Stream (uploaded as generic file to preserve bytes)
  const doImageUploadRequest = useCallback(
    async (file, ch) => {
      validateFile(file, true); // throws on invalid type/size
      if (!channelCryptoKey) {
        const { file: url } = await ch.sendImage(file);
        return { file: url };
      }
      const toUpload = await encryptFile(channelCryptoKey, file);
      const { file: url } = await ch.sendFile(toUpload);
      return { file: url };
    },
    [channelCryptoKey]
  );

  return (
    <GiphyContext.Provider value={{ giphyState, setGiphyState }}>
      {/* Thông báo cuộc gọi đến */}
      {incomingCall && !showVideoCall && (
        <div className="incoming-call-banner">
          <span className="incoming-call-icon">📞</span>
          <span className="incoming-call-text">
            <strong>{incomingCall.callerName}</strong> đang gọi video...
          </span>
          <button
            className="incoming-call-btn accept"
            onClick={() => {
              setIncomingCall(null);
              setShowVideoCall(true);
              setIsMeetingOngoing(true);
            }}
          >
            Tham gia
          </button>
          <button
            className="incoming-call-btn decline"
            onClick={() => setIncomingCall(null)}
          >
            Từ chối
          </button>
        </div>
      )}

      {showVideoCall && (
        <VideoCall
          channel={channel}
          onClose={() => {
            setShowVideoCall(false);
            setIsMeetingOngoing(false);
          }}
          currentUser={client.user}
        />
      )}
      <div style={{ display: "flex", width: "100%" }}>
        <Window>
          <TeamChannelHeader
            setIsEditing={setIsEditing}
            onStartVideoCall={() => {
              // Thông báo cho các thành viên khác trong channel
              const callerName = client.user?.fullName || client.user?.name || client.user?.id;
              webrtcService.notifyCallStarted(channel.id, client.user.id, callerName);
              setShowVideoCall(true);
              setIsMeetingOngoing(true);
            }}
            isMeetingOngoing={isMeetingOngoing}
          />
          {!channelCryptoKey && (
            keyError ? (
              <div style={{
                background: "#f8d7da", color: "#721c24", fontSize: 12,
                padding: "4px 12px", textAlign: "center", borderBottom: "1px solid #f5c6cb"
              }}>
                ⚠️ Không thể tải khóa mã hóa. Vui lòng tải lại trang hoặc liên hệ admin.
              </div>
            ) : (
              <div style={{
                background: "#fff3cd", color: "#856404", fontSize: 12,
                padding: "4px 12px", textAlign: "center", borderBottom: "1px solid #ffc107"
              }}>
                Đang tải khóa mã hóa... Vui lòng chờ trước khi gửi tin nhắn.
              </div>
            )
          )}
          <MessageList Message={EncryptedMessage} />
          <MessageInput
            overrideSubmitHandler={overrideSubmitHandler}
            doFileUploadRequest={doFileUploadRequest}
            doImageUploadRequest={doImageUploadRequest}
            disabled={!channelCryptoKey}
          />
        </Window>
        {/* Thread dùng cùng handler để reply cũng được mã hóa */}
        <Thread
          Message={EncryptedMessage}
          additionalMessageInputProps={{
            overrideSubmitHandler,
            doFileUploadRequest,
            doImageUploadRequest,
            disabled: !channelCryptoKey,
          }}
        />
      </div>
    </GiphyContext.Provider>
  );
};

// ── Channel header ────────────────────────────────────────────────────────────

const TeamChannelHeader = ({ setIsEditing, onStartVideoCall, isMeetingOngoing }) => {
  const { channel } = useChannelStateContext();
  const { client }  = useChatContext();
  const userRole    = cookies.get("role") || "student";

  const MessagingHeader = () => {
    const members = Object.values(channel.state.members).filter(
      ({ user }) => user.id !== client.userID
    );
    const additionalMembers = members.length - 3;

    if (channel.type === "messaging") {
      return (
        <div className="team-channel-header__name-wrapper">
          {members.map(({ user }, i) => (
            <div key={i} className="team-channel-header__name-multi">
              <Avatar
                image={user.image}
                name={user.name || user.fullName || user.id}
                size={32}
              />
              <p className="team-channel-header__name user">
                {user.name || user.fullName || user.id}
              </p>
            </div>
          ))}
          {additionalMembers > 0 && (
            <p className="team-channel-header__name user">
              and {additionalMembers} more
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="team-channel-header__channel-wrapper">
        <p className="team-channel-header__name">
          <span className="channel-hash-icon">#</span>
          {channel.data.name}
        </p>
        {(userRole === "admin" || userRole === "teacher") && (
          <span style={{ display: "flex" }} onClick={() => setIsEditing(true)}>
            <ChannelInfo />
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="team-channel-header__container">
      <MessagingHeader />
      <div className="team-channel-header__right">
        <div
          className="team-channel-header__icon-button"
          onClick={onStartVideoCall}
          title={isMeetingOngoing ? "Join Meeting" : "Start Meeting"}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 10L20 6V18L15 14V10Z" stroke="#6264A7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 8H11C12.1046 8 13 8.89543 13 10V14C13 15.1046 12.1046 16 11 16H4C2.89543 16 2 15.1046 2 14V10C2 8.89543 2.89543 8 4 8Z" stroke="#6264A7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default ChannelInner;
