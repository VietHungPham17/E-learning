import React, { useState } from "react";
import { useChatContext } from "stream-chat-react";

import { UserList } from "./";
import { CloseCreateChannel } from "../assets";
import apiClient from "../services/apiClient";

const ChannelNameInput = ({ channelName = "", setChannelName }) => (
  <div className="channel-name-input__wrapper">
    <p>Tên kênh</p>
    <input
      value={channelName}
      onChange={(e) => setChannelName(e.target.value)}
      placeholder="tên-kênh"
      maxLength={64}
    />
    <p>Thêm thành viên</p>
  </div>
);

const CreateChannel = ({ createType, setIsCreating }) => {
  const { client, setActiveChannel } = useChatContext();
  const [selectedUsers, setSelectedUsers] = useState([client.userID || ""]);
  const [channelName, setChannelName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const createChannel = async (e) => {
    e.preventDefault();
    setError("");

    if (createType === "team" && !channelName.trim()) {
      setError("Vui lòng nhập tên kênh");
      return;
    }

    // Require at least one OTHER member for DMs
    const otherMembers = selectedUsers.filter((id) => id !== client.userID);
    if (otherMembers.length === 0) {
      setError("Vui lòng chọn ít nhất 1 người nhận");
      return;
    }

    setCreating(true);
    try {
      // Tạo channel qua server (admin credentials) để đảm bảo
      // Stream luôn thêm đủ thành viên và gửi notification đến họ.
      const { data } = await apiClient.post("/api/channels", {
        type: createType,
        name: channelName,
        members: selectedUsers,
      });

      // Watch channel để subscribe sự kiện real-time
      const newChannel = client.channel(data.type, data.id);
      await newChannel.watch();

      setChannelName("");
      setIsCreating(false);
      setSelectedUsers([client.userID]);
      setActiveChannel(newChannel);
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi tạo kênh, vui lòng thử lại");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="create-channel__container">
      <div className="create-channel__header">
        <p>
          {createType === "team" ? "Tạo kênh mới" : "Gửi tin nhắn trực tiếp"}
        </p>
        <CloseCreateChannel setIsCreating={setIsCreating} />
      </div>

      {createType === "team" && (
        <ChannelNameInput
          channelName={channelName}
          setChannelName={setChannelName}
        />
      )}

      <UserList setSelectedUsers={setSelectedUsers} />

      {error && (
        <p style={{ color: "#e74c3c", padding: "0 16px", fontSize: "13px" }}>
          {error}
        </p>
      )}

      <div
        className="create-channel__button-wrapper"
        onClick={creating ? undefined : createChannel}
        style={{ opacity: creating ? 0.6 : 1, cursor: creating ? "not-allowed" : "pointer" }}
      >
        <p>
          {creating
            ? "Đang tạo..."
            : createType === "team"
            ? "Tạo kênh"
            : "Tạo nhóm tin nhắn"}
        </p>
      </div>
    </div>
  );
};

export default CreateChannel;
