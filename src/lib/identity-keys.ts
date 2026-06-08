const IDENTITY_PRIVATE_KEY_PREFIX = "yoobro-identity-private-key";

const encoder = new TextEncoder();

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const toBase64 = (value: string) => window.btoa(unescape(encodeURIComponent(value)));
const fromBase64 = (value: string) => decodeURIComponent(escape(window.atob(value)));

export const getIdentityPrivateKeyStorageKey = (userId: string) => `${IDENTITY_PRIVATE_KEY_PREFIX}:${userId}`;

export const getStoredPrivateIdentityKey = (userId: string) => {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(getIdentityPrivateKeyStorageKey(userId));
  } catch {
    return null;
  }
};

export const storePrivateIdentityKey = (userId: string, privateJwk: JsonWebKey) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getIdentityPrivateKeyStorageKey(userId), JSON.stringify(privateJwk));
  } catch {
    // Ignore storage failures.
  }
};

export const createIdentityKeyPair = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"],
  );

  const publicJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const fingerprint = await createIdentityFingerprint(publicJwk);

  return {
    publicJwk,
    privateJwk,
    fingerprint,
  };
};

export const createIdentityFingerprint = async (publicJwk: JsonWebKey) => {
  const payload = JSON.stringify({
    crv: publicJwk.crv,
    kty: publicJwk.kty,
    x: publicJwk.x,
    y: publicJwk.y,
  });
  const hash = await window.crypto.subtle.digest("SHA-256", encoder.encode(payload));
  const fingerprintHex = bytesToHex(new Uint8Array(hash)).toUpperCase();
  return fingerprintHex.match(/.{1,4}/g)?.slice(0, 8).join(" ") ?? fingerprintHex;
};

export const serializePublicIdentityKey = (publicJwk: JsonWebKey) => toBase64(JSON.stringify(publicJwk));

export const deserializePublicIdentityKey = (serializedKey: string) => JSON.parse(fromBase64(serializedKey)) as JsonWebKey;

export const importStoredPrivateIdentityKey = async (userId: string) => {
  const privateKeyRaw = getStoredPrivateIdentityKey(userId);
  if (!privateKeyRaw) return null;

  return window.crypto.subtle.importKey(
    "jwk",
    JSON.parse(privateKeyRaw) as JsonWebKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"],
  );
};

export const importPublicIdentityKey = async (serializedPublicKey: string) => {
  return window.crypto.subtle.importKey(
    "jwk",
    deserializePublicIdentityKey(serializedPublicKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
};

export const deriveSharedConversationSecret = async (userId: string, remoteSerializedPublicKey: string) => {
  const privateKey = await importStoredPrivateIdentityKey(userId);
  if (!privateKey) return null;

  const remotePublicKey = await importPublicIdentityKey(remoteSerializedPublicKey);
  const sharedBits = await window.crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: remotePublicKey,
    },
    privateKey,
    256,
  );

  return bytesToHex(new Uint8Array(sharedBits));
};
