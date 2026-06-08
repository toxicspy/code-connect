const DEVICE_ID_STORAGE_KEY = "yoobro-device-id";
const DEVICE_ID_COOKIE_KEY = "yoobro_device_id";

const readCookie = (name: string) => {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const writeCookie = (name: string, value: string) => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
};

const readStoredDeviceId = () => {
  if (typeof window === "undefined") return null;

  try {
    const localValue = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (localValue) return localValue;
  } catch {
    // Ignore storage failure and fall back to cookies.
  }

  return readCookie(DEVICE_ID_COOKIE_KEY);
};

const persistDeviceId = (deviceId: string) => {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    } catch {
      // Ignore storage failure and still write cookie fallback.
    }
  }

  writeCookie(DEVICE_ID_COOKIE_KEY, deviceId);
};

const encode = (value: string) => new TextEncoder().encode(value);

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const buildFingerprintSource = () => {
  const sourceParts = [
    navigator.userAgent || "",
    `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    navigator.language || "",
    navigator.platform || "",
  ];

  return sourceParts.join("::");
};

const hashFingerprintSource = async (source: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encode(source));
  return bytesToHex(new Uint8Array(digest));
};

export const getOrCreateDeviceId = async () => {
  const existing = readStoredDeviceId();
  if (existing) return existing;

  const source = buildFingerprintSource();
  const hashed = await hashFingerprintSource(source);
  persistDeviceId(hashed);
  return hashed;
};

export const getStoredDeviceId = () => readStoredDeviceId();
