import React, { useContext, useState, useEffect } from "react";
import { Attachment } from "stream-chat-react";
import { CryptoContext } from "../context/CryptoContext";
import {
  decryptBuffer,
  isEncryptedAttachment,
  originalName,
  isImageFile,
} from "../services/cryptoService";

/**
 * Drop-in replacement for Stream's <Attachment>.
 * - Passes non-encrypted attachments straight to the default renderer.
 * - For encrypted attachments (title ends with ".aesenc"):
 *     • Images  → fetches + decrypts + shows inline <img>
 *     • Files   → fetches + decrypts + triggers browser download
 */
const EncryptedAttachment = (props) => {
  const { channelCryptoKey } = useContext(CryptoContext);

  // Stream passes { attachments: [...] }
  const attachments = props.attachments || [];

  return (
    <>
      {attachments.map((att, i) => {
        if (!isEncryptedAttachment(att) || !channelCryptoKey) {
          return <Attachment key={i} {...props} attachments={[att]} />;
        }
        return (
          <EncryptedItem key={i} attachment={att} cryptoKey={channelCryptoKey} />
        );
      })}
    </>
  );
};

// ── Single encrypted attachment ────────────────────────────────────────────

const EncryptedItem = ({ attachment, cryptoKey }) => {
  const [status, setStatus]       = useState("idle"); // idle | loading | done | error
  const [objectUrl, setObjectUrl] = useState(null);
  const name    = originalName(attachment.title);
  const isImage = isImageFile(name);

  // Revoke object URL when component unmounts to free browser memory
  useEffect(() => {
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [objectUrl]);

  const handleAction = async () => {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res        = await fetch(attachment.asset_url);
      const encBuffer  = await res.arrayBuffer();
      const plainBuffer = await decryptBuffer(cryptoKey, encBuffer);
      const blob       = new Blob([plainBuffer]);

      if (isImage) {
        const url = URL.createObjectURL(blob);
        setObjectUrl(url);
        setStatus("done");
      } else {
        // Trigger download
        const url = URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href     = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        setStatus("idle");
      }
    } catch (err) {
      console.error("[EncryptedAttachment] decrypt failed", err);
      setStatus("error");
    }
  };

  // After decryption, show inline image
  if (status === "done" && objectUrl) {
    return (
      <div className="encrypted-attachment encrypted-attachment--image">
        <img src={objectUrl} alt={name} style={{ maxWidth: 300, borderRadius: 8 }} />
        <p className="encrypted-attachment__label">🔒 {name}</p>
      </div>
    );
  }

  const buttonLabel = () => {
    if (status === "loading") return "Đang giải mã...";
    if (status === "error")   return "Thử lại";
    return isImage ? "🔒 Xem ảnh" : "🔒 Tải xuống";
  };

  return (
    <div className="encrypted-attachment">
      <span className="encrypted-attachment__name">{name}</span>
      <button
        className="encrypted-attachment__btn"
        onClick={handleAction}
        disabled={status === "loading"}
      >
        {buttonLabel()}
      </button>
      {status === "error" && (
        <span className="encrypted-attachment__error">Giải mã thất bại</span>
      )}
    </div>
  );
};

export default EncryptedAttachment;
