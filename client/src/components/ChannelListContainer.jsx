import React, { useState, useMemo } from "react";
import { ChannelList, useChatContext } from "stream-chat-react";
import Cookies from "universal-cookie";

import { ChannelSearch, TeamChannelList, TeamChannelPreview } from "./";
import LogoutIcon from "../assets/logout.png";
import QuzzIcon from "../assets/quizz.jpg";
import { AdminIcon } from "../assets";

const cookies = new Cookies();

const SideBar = ({
  logout,
  toggleSidebar,
  isCollapsed,
  userRole,
  openAdminPanel,
  isAdminMode,
  closeAdminPanel,
  openProfilePanel,
  isProfileMode,
  openQuizPanel,
  isQuizMode,
}) => (
  <div
    className="channel-list__sidebar"
    style={{ display: "flex", flexDirection: "column", height: "100%" }}
  >
    <div
      className={`channel-list__sidebar__icon2 ${
        isProfileMode ? "selected" : ""
      }`}
    >
      <div className="icon1__inner" onClick={openProfilePanel} title="Profile">
        <span style={{ color: "#fff", fontSize: "28px" }}>👤</span>
      </div>
    </div>

    <div className="channel-list__sidebar__icon2">
      <div className="icon1__inner" onClick={logout}>
        <img src={LogoutIcon} alt="Logout" width="30" />
      </div>
    </div>

    <div
      className={`channel-list__sidebar__icon2 ${
        !isAdminMode && !isProfileMode && !isQuizMode ? "selected" : ""
      }`}
    >
      <div className="icon1__inner" onClick={closeAdminPanel} title="Chat">
        <span style={{ color: "#fff", fontSize: "28px" }}>💬</span>
      </div>
    </div>

    <div
      className={`channel-list__sidebar__icon2 ${isQuizMode ? "selected" : ""}`}
    >
      <div className="icon1__inner" title="Quiz" onClick={openQuizPanel}>
        <img src={QuzzIcon} alt="Quizz" width="30" />
      </div>
    </div>

    {userRole === "admin" && (
      <div
        className={`channel-list__sidebar__icon2 ${
          isAdminMode ? "selected" : ""
        }`}
      >
        <div
          className="icon1__inner"
          onClick={openAdminPanel}
          title="Admin Panel"
        >
          <AdminIcon width="30" height="30" />
        </div>
      </div>
    )}

    <div style={{ marginTop: "auto" }}>
      <div className="channel-list__sidebar__icon3">
        <div
          className="icon1__inner"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
        >
          <span
            style={{
              fontSize: "40px",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: isCollapsed ? "rotate(360deg)" : "none",
              transition: "transform 0.5s ease",
            }}
          >
            {isCollapsed ? "»" : "«"}
          </span>
        </div>
      </div>
    </div>
  </div>
);

const CompanyHeader = () => (
  <div className="channel-list__header">
    <p className="channel-list__header__text">Chat Pager</p>
  </div>
);

const customChannelTeamFilter = (channels) => {
  return channels.filter((channel) => channel.type === "team");
};

const customChannelMessagingFilter = (channels) => {
  return channels.filter((channel) => channel.type === "messaging");
};

const AdminMenuList = ({ activeAdminTab, setActiveAdminTab }) => {
  return (
    <div className="admin-menu-list">
      <div className="team-channel-list">
        <div className="team-channel-list__header">
          <p className="team-channel-list__header__title">Admin Panel</p>
        </div>

        <div
          className={`admin-menu-item ${
            activeAdminTab === "users" ? "active" : ""
          }`}
          onClick={() => setActiveAdminTab("users")}
        >
          <div className="admin-menu-icon">👥</div>
          <span>Users Management</span>
        </div>

        <div
          className={`admin-menu-item ${
            activeAdminTab === "channels" ? "active" : ""
          }`}
          onClick={() => setActiveAdminTab("channels")}
        >
          <div className="admin-menu-icon">💬</div>
          <span>Channels Management</span>
        </div>
      </div>
    </div>
  );
};

// Component cho Profile Menu thay thế Channels và Direct Messages
const ProfileMenuList = ({ activeProfileTab, setActiveProfileTab }) => {
  return (
    <div className="profile-menu-list">
      <div className="team-channel-list">
        <div className="team-channel-list__header">
          <p className="team-channel-list__header__title">Tài khoản</p>
        </div>

        <div
          className={`admin-menu-item ${
            activeProfileTab === "info" ? "active" : ""
          }`}
          onClick={() => setActiveProfileTab("info")}
        >
          <div className="admin-menu-icon">👤</div>
          <span>Thông tin cá nhân</span>
        </div>

        <div
          className={`admin-menu-item ${
            activeProfileTab === "password" ? "active" : ""
          }`}
          onClick={() => setActiveProfileTab("password")}
        >
          <div className="admin-menu-icon">🔒</div>
          <span>Thay đổi mật khẩu</span>
        </div>

        <div
          className={`admin-menu-item ${
            activeProfileTab === "security" ? "active" : ""
          }`}
          onClick={() => setActiveProfileTab("security")}
        >
          <div className="admin-menu-icon">🛡️</div>
          <span>Bảo mật (2FA)</span>
        </div>
      </div>
    </div>
  );
};

const ChannelListContent = ({
  isCreating,
  setIsCreating,
  setCreateType,
  setIsEditing,
  setToggleContainer,
  isCollapsed,
  toggleSidebar,
  userRole,
  openAdminPanel,
  isAdminMode,
  activeAdminTab,
  setActiveAdminTab,
  closeAdminPanel,
  openProfilePanel,
  isProfileMode,
  activeProfileTab,
  setActiveProfileTab,
  openQuizPanel,
  isQuizMode,
}) => {
  const { client } = useChatContext();

  // Memoize để tránh ChannelList re-fetch mỗi lần re-render
  const filters = useMemo(
    () => ({ members: { $in: [client.userID] } }),
    [client.userID]
  );
  const sort    = useMemo(() => ({ last_message_at: -1, updated_at: -1 }), []);
  const options = useMemo(() => ({ limit: 30, message_limit: 10, state: true }), []);

  const logout = () => {
    cookies.remove("token");
    cookies.remove("userId");
    cookies.remove("username");
    cookies.remove("fullName");
    cookies.remove("avatarURL");
    cookies.remove("hashedPassword");
    cookies.remove("phoneNumber");
    cookies.remove("role");

    window.location.reload();
  };

  // compute total online users from client state
  const totalOnline = Object.values(client.state?.users || {}).filter(
    (u) => u?.online
  ).length;

  return (
    <>
      <SideBar
        logout={logout}
        toggleSidebar={toggleSidebar}
        isCollapsed={isCollapsed}
        userRole={userRole}
        openAdminPanel={openAdminPanel}
        isAdminMode={isAdminMode}
        closeAdminPanel={closeAdminPanel}
        openProfilePanel={openProfilePanel}
        isProfileMode={isProfileMode}
        openQuizPanel={openQuizPanel}
        isQuizMode={isQuizMode}
      />
      {/* Khi collapsed: chỉ hiển thị sidebar icons, giữ layout ổn định */}
      {!isCollapsed && (
        <div
          className="channel-list__list__wrapper"
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <CompanyHeader />

          {/* Hiển thị Admin Menu khi isAdminMode = true hoặc Profile Menu khi isProfileMode = true */}
          {isAdminMode ? (
            <AdminMenuList
              activeAdminTab={activeAdminTab}
              setActiveAdminTab={setActiveAdminTab}
            />
          ) : isProfileMode ? (
            <ProfileMenuList
              activeProfileTab={activeProfileTab}
              setActiveProfileTab={setActiveProfileTab}
            />
          ) : (
            <>
              <ChannelSearch setToggleContainer={setToggleContainer} />
              <ChannelList
                filters={filters}
                sort={sort}
                options={options}
                channelRenderFilterFn={customChannelTeamFilter}
                List={(listProps) => (
                  <TeamChannelList
                    {...listProps}
                    type="team"
                    isCreating={isCreating}
                    setIsCreating={setIsCreating}
                    setCreateType={setCreateType}
                    setIsEditing={setIsEditing}
                    setToggleContainer={setToggleContainer}
                    userRole={userRole}
                  />
                )}
                Preview={(previewProps) => (
                  <TeamChannelPreview
                    {...previewProps}
                    setIsCreating={setIsCreating}
                    setIsEditing={setIsEditing}
                    setToggleContainer={setToggleContainer}
                    type="team"
                    isQuizMode={isQuizMode}
                  />
                )}
              />
              {/* Chỉ hiển thị Direct Messages khi KHÔNG ở quiz mode */}
              {!isQuizMode && (
                <ChannelList
                  filters={filters}
                  sort={sort}
                  options={options}
                  channelRenderFilterFn={customChannelMessagingFilter}
                  List={(listProps) => (
                    <TeamChannelList
                      {...listProps}
                      type="messaging"
                      isCreating={isCreating}
                      setIsCreating={setIsCreating}
                      setCreateType={setCreateType}
                      setIsEditing={setIsEditing}
                      setToggleContainer={setToggleContainer}
                      userRole={userRole}
                    />
                  )}
                  Preview={(previewProps) => (
                    <TeamChannelPreview
                      {...previewProps}
                      setIsCreating={setIsCreating}
                      setIsEditing={setIsEditing}
                      setToggleContainer={setToggleContainer}
                      type="messaging"
                      isQuizMode={isQuizMode}
                    />
                  )}
                />
              )}
            </>
          )}

          {/* Footer showing total online users placed at the very bottom */}
          <div
            className="channel-list__footer"
            style={{ marginTop: "auto", padding: "10px", textAlign: "center" }}
          >
            <p className="team-channel-list__header__title">
              {typeof totalOnline === "number"
                ? `${totalOnline} users online`
                : "No users online"}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

const ChannelListContainer = ({
  setCreateType,
  setIsCreating,
  setIsEditing,
  viewMode,
  setViewMode,
  userRole,
  activeAdminTab,
  setActiveAdminTab,
  activeProfileTab,
  setActiveProfileTab,
  isQuizMode,
  setIsQuizMode,
  isCollapsed,
  setIsCollapsed,
}) => {
  const [toggleContainer, setToggleContainer] = useState(false);
  // Admin mode state
  const [isAdminMode, setIsAdminMode] = useState(false);
  // Profile mode state
  const [isProfileMode, setIsProfileMode] = useState(false);

  const toggleSidebar = () => setIsCollapsed((prev) => !prev);

  const openAdminPanel = () => {
    if (userRole === "admin") {
      setIsAdminMode(true);
      setIsProfileMode(false);
      setIsQuizMode(false);
      setViewMode("admin");
    }
  };

  const openProfilePanel = () => {
    setIsProfileMode(true);
    setIsAdminMode(false);
    setIsQuizMode(false);
    setViewMode("profile");
  };

  const openQuizPanel = () => {
    setIsQuizMode(true);
    setIsAdminMode(false);
    setIsProfileMode(false);
    setViewMode("chat"); // Vẫn ở chat view để hiển thị channel list
  };

  const closeAdminPanel = () => {
    setIsAdminMode(false);
    setIsProfileMode(false);
    setIsQuizMode(false);
    setViewMode("chat");
  };

  return (
    <>
      <div
        className="channel-list__container"
        style={{ width: isCollapsed ? "72px" : undefined }}
      >
        <ChannelListContent
          setIsCreating={setIsCreating}
          setCreateType={setCreateType}
          setIsEditing={setIsEditing}
          isCollapsed={isCollapsed}
          toggleSidebar={toggleSidebar}
          userRole={userRole}
          openAdminPanel={openAdminPanel}
          isAdminMode={isAdminMode}
          activeAdminTab={activeAdminTab}
          setActiveAdminTab={setActiveAdminTab}
          closeAdminPanel={closeAdminPanel}
          openProfilePanel={openProfilePanel}
          isProfileMode={isProfileMode}
          activeProfileTab={activeProfileTab}
          setActiveProfileTab={setActiveProfileTab}
          openQuizPanel={openQuizPanel}
          isQuizMode={isQuizMode}
          // theme={theme}
          // toggleTheme={toggleTheme}
        />
      </div>

      <div
        className="channel-list__container-responsive"
        style={{
          left: toggleContainer ? "0%" : "-89%",
          backgroundColor: "#005fff",
        }}
      >
        <div
          className="channel-list__container-toggle"
          onClick={() =>
            setToggleContainer((prevToggleContainer) => !prevToggleContainer)
          }
        ></div>
        <ChannelListContent
          setIsCreating={setIsCreating}
          setCreateType={setCreateType}
          setIsEditing={setIsEditing}
          setToggleContainer={setToggleContainer}
          isCollapsed={false} // responsive: luôn mở khi active
          toggleSidebar={() => {}}
          userRole={userRole}
          openAdminPanel={openAdminPanel}
          isAdminMode={isAdminMode}
          activeAdminTab={activeAdminTab}
          setActiveAdminTab={setActiveAdminTab}
          closeAdminPanel={closeAdminPanel}
          openProfilePanel={openProfilePanel}
          isProfileMode={isProfileMode}
          activeProfileTab={activeProfileTab}
          setActiveProfileTab={setActiveProfileTab}
          openQuizPanel={openQuizPanel}
          isQuizMode={isQuizMode}
        />
      </div>
    </>
  );
};

export default ChannelListContainer;
