import { useState, useEffect } from "react";
import { Channel, MessageSimple, useChatContext } from "stream-chat-react";

import { ChannelInner, CreateChannel, EditChannel } from "./";
import ChannelQuizView from "./ChannelQuizView";
import EncryptedAttachment from "./EncryptedAttachment";
import { CryptoContext } from "../context/CryptoContext";
import { importKey } from "../services/cryptoService";
import apiClient from "../services/apiClient";

const ChannelContainer = ({
  isCreating,
  setIsCreating,
  isEditing,
  setIsEditing,
  createType,
  userRole,
  isQuizMode,
  isCollapsed,
}) => {
  const { channel } = useChatContext();
  const [channelCryptoKey, setChannelCryptoKey] = useState(null);
  const [keyError, setKeyError] = useState(false);

  // Fetch AES-256 key for the active channel whenever it changes
  useEffect(() => {
    if (!channel?.cid) {
      setChannelCryptoKey(null);
      setKeyError(false);
      return;
    }
    let cancelled = false;
    setKeyError(false);

    const fetchKey = async () => {
      try {
        const { data } = await apiClient.post("/api/channel-key", { channelId: channel.cid });
        const cryptoKey = await importKey(data.key);
        if (!cancelled) {
          setChannelCryptoKey(cryptoKey);
          setKeyError(false);
        }
      } catch (err) {
        console.error("[CRYPTO] Failed to fetch channel key:", err?.response?.data || err.message);
        if (!cancelled) {
          setChannelCryptoKey(null);
          setKeyError(true);
        }
      }
    };

    fetchKey();
    return () => { cancelled = true; };
  }, [channel?.cid]);

  if (isQuizMode) {
    return (
      <div className={`channel__container ${isCollapsed ? "collapsed" : ""}`}>
        <ChannelQuizView userRole={userRole} />
      </div>
    );
  }

  if (isCreating) {
    return (
      <div className={`channel__container ${isCollapsed ? "collapsed" : ""}`}>
        <CreateChannel createType={createType} setIsCreating={setIsCreating} />
      </div>
    );
  }
  if (isEditing) {
    return (
      <div className={`channel__container ${isCollapsed ? "collapsed" : ""}`}>
        <EditChannel setIsEditing={setIsEditing} />
      </div>
    );
  }

  const EmptyState = () => (
    <div className="channel-empty__container">
      <p className="channel-empty__first">
        This is the beginning of your chat history.
      </p>
      <p className="channel-empty__second">
        Send messages, attachments, links, emojis, and more!
      </p>
    </div>
  );

  return (
    <CryptoContext.Provider value={{ channelCryptoKey, keyError }}>
      <div className={`channel__container ${isCollapsed ? "collapsed" : ""}`}>
        <Channel
          EmptyStateIndicator={EmptyState}
          Message={(messageProps, i) => <MessageSimple key={i} {...messageProps} />}
          Attachment={EncryptedAttachment}
        >
          <ChannelInner setIsEditing={setIsEditing} />
        </Channel>
      </div>
    </CryptoContext.Provider>
  );
};

export default ChannelContainer;
