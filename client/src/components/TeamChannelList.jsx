import React from "react";

import { AddChannel } from "../assets";

const TeamChannelList = ({
  setToggleContainer,
  children,
  error = false,
  loading,
  type,
  isCreating,
  setIsCreating,
  setCreateType,
  setIsEditing,
  userRole,
}) => {
  if (error) {
    return type === "team" ? (
      <div className="team-channel-list">
        <p className="team-channel-list__message">
          Connection error, please wait a moment and try again. 
          {console.log(error)}
          
        </p>
      </div>
    ) : null;
  }
  if (loading) {
    return (
      <div className="team-channel-list">
        <p className="team-channel-list__message loading">
          {type === "team" ? "Channels" : "Messages"} loading...
        </p>
      </div>
    );
  }

  // Kiểm tra quyền: Student chỉ được tạo Direct Message, không được tạo Team Channel
  const canCreateChannel = () => {
    if (type === "messaging") {
      // Tất cả roles đều có thể tạo Direct Message
      return true;
    }
    if (type === "team") {
      // Chỉ Admin và Teacher mới có thể tạo Team Channel
      return userRole === "admin" || userRole === "teacher";
    }
    return false;
  };

  return (
    <div className="team-channel-list">
      <div className="team-channel-list__header">
        <p className="team-channel-list__header__title">
          {type === "team" ? "Channels" : "Direct Messages"}
        </p>
        {canCreateChannel() && (
          <AddChannel
            isCreating={isCreating}
            setIsCreating={setIsCreating}
            setCreateType={setCreateType}
            setIsEditing={setIsEditing}
            type={type === "team" ? "team" : "messaging"}
            setToggleContainer={setToggleContainer}
          />
        )}
      </div>
      {children}
    </div>
  );
};

export default TeamChannelList;
