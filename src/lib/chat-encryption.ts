const ENCRYPTION_STORAGE_KEY = "yoobro-conversation-encryption";
const PBKDF2_ITERATIONS = 120000;
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;

export const ENCRYPTION_VERSION = 1;
export const ENCRYPTED_MESSAGE_FALLBACK = "Encrypted message";
export const ENCRYPTED_MESSAGE_LOCKED = "Encrypted message. Unlock this chat to read it.";
export const ENCRYPTED_MESSAGE_FAILED = "Encrypted message. Unable to decrypt with this passphrase.";

interface StoredConversationEncryptionMap {
  [conversationId: string]: {
    passphrase: string;
  };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const deriveSalt = (conversationId: string) => encoder.encode(`yoobro-e2ee:${conversationId}`);

const deriveConversationKey = async (conversationId: string, passphrase: string) => {
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: deriveSalt(conversationId),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
};

const readStoredMap = (): StoredConversationEncryptionMap => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(ENCRYPTION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredConversationEncryptionMap) : {};
  } catch {
    return {};
  }
};

const writeStoredMap = (nextMap: StoredConversationEncryptionMap) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ENCRYPTION_STORAGE_KEY, JSON.stringify(nextMap));
  } catch {
    // Ignore storage failures to avoid blocking chat.
  }
};

export const getConversationPassphrase = (conversationId: string) => {
  return readStoredMap()[conversationId]?.passphrase ?? null;
};

export const setConversationPassphrase = (conversationId: string, passphrase: string) => {
  const nextMap = readStoredMap();
  nextMap[conversationId] = { passphrase };
  writeStoredMap(nextMap);
};

export const clearConversationPassphrase = (conversationId: string) => {
  const nextMap = readStoredMap();
  delete nextMap[conversationId];
  writeStoredMap(nextMap);
};

export const isConversationEncrypted = (conversationId: string) => Boolean(getConversationPassphrase(conversationId));

export const encryptConversationText = async (conversationId: string, plaintext: string) => {
  const passphrase = getConversationPassphrase(conversationId);
  if (!passphrase) {
    return null;
  }

  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveConversationKey(conversationId, passphrase);
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );

  return {
    content: bytesToBase64(new Uint8Array(cipherBuffer)),
    nonce: bytesToBase64(iv),
    version: ENCRYPTION_VERSION,
  };
};

export const decryptConversationText = async (conversationId: string, ciphertext: string, nonce: string | null | undefined) => {
  const passphrase = getConversationPassphrase(conversationId);
  if (!passphrase || !nonce) {
    return null;
  }

  const key = await deriveConversationKey(conversationId, passphrase);
  const plaintextBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(nonce) },
    key,
    base64ToBytes(ciphertext),
  );

  return decoder.decode(plaintextBuffer);
};
