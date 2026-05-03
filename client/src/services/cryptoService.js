/**
 * cryptoService.js — AES-256-GCM encryption/decryption using the browser Web Crypto API.
 *
 * Message format : "ENC:<iv_base64>:<ciphertext_base64>"
 * File format    : first 12 bytes = IV, rest = ciphertext
 * File name      : "enc_<originalname>.aesenc"
 */

const IV_LENGTH  = 12; // 96-bit IV recommended for AES-GCM
const ENC_PREFIX = "ENC:";
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function bufToB64(buffer) {
  return btoa(Array.from(new Uint8Array(buffer), (b) => String.fromCharCode(b)).join(""));
}

function b64ToBuf(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}

// ── Key import ────────────────────────────────────────────────────────────────

/**
 * Import a raw base64-encoded AES-256 key from the server into a CryptoKey.
 * @param {string} base64Key
 * @returns {Promise<CryptoKey>}
 */
export async function importKey(base64Key) {
  return crypto.subtle.importKey(
    "raw",
    b64ToBuf(base64Key),
    { name: "AES-GCM", length: 256 },
    false,            // not extractable — key stays inside Web Crypto
    ["encrypt", "decrypt"]
  );
}

// ── Text ─────────────────────────────────────────────────────────────────────

/**
 * Encrypt plain text → "ENC:<iv>:<ciphertext>" (both base64).
 * Returns the original string unchanged if cryptoKey is null.
 */
export async function encryptText(cryptoKey, plaintext) {
  if (!cryptoKey || !plaintext) return plaintext;
  const iv       = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipher   = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    new TextEncoder().encode(plaintext)
  );
  return `${ENC_PREFIX}${bufToB64(iv)}:${bufToB64(cipher)}`;
}

/**
 * Decrypt "ENC:<iv>:<ciphertext>" → plain text.
 * Returns the original string if it is not in encrypted format.
 */
export async function decryptText(cryptoKey, text) {
  if (!cryptoKey || !text || !text.startsWith(ENC_PREFIX)) return text;
  try {
    const rest  = text.slice(ENC_PREFIX.length);
    const sep   = rest.indexOf(":");
    const iv    = new Uint8Array(b64ToBuf(rest.slice(0, sep)));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      b64ToBuf(rest.slice(sep + 1))
    );
    return new TextDecoder().decode(plain);
  } catch {
    return "🔒 [Không thể giải mã]";
  }
}

// ── Files ─────────────────────────────────────────────────────────────────────

/**
 * Encrypt a File object.
 * @returns {File} — "enc_<originalname>.aesenc" (application/octet-stream)
 */
export async function encryptFile(cryptoKey, file) {
  if (!cryptoKey) return file;
  const iv     = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    await file.arrayBuffer()
  );
  // Layout: [12 bytes IV][ciphertext]
  const out = new Uint8Array(IV_LENGTH + cipher.byteLength);
  out.set(iv);
  out.set(new Uint8Array(cipher), IV_LENGTH);
  return new File([out], `enc_${file.name}.aesenc`, { type: "application/octet-stream" });
}

/**
 * Decrypt an encrypted ArrayBuffer (layout: IV || ciphertext).
 * @returns {ArrayBuffer} — original file bytes
 */
export async function decryptBuffer(cryptoKey, encBuffer) {
  if (!cryptoKey) throw new Error("No crypto key");
  const data = new Uint8Array(encBuffer);
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: data.slice(0, IV_LENGTH) },
    cryptoKey,
    data.slice(IV_LENGTH)
  );
}

// ── Attachment helpers ────────────────────────────────────────────────────────

/** True if the attachment was encrypted by us. */
export function isEncryptedAttachment(attachment) {
  return typeof attachment?.title === "string" && attachment.title.endsWith(".aesenc");
}

/** Recover original filename from an encrypted attachment title. */
export function originalName(title) {
  return title.replace(/^enc_/, "").replace(/\.aesenc$/, "");
}

/** True if the original file is an image based on extension. */
export function isImageFile(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return IMAGE_EXTS.has(ext);
}
