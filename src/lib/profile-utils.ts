const TRAILING_IDENTIFIER_PATTERN = /\s+[0-9a-f]{4,8}(?:[\s-]+[0-9a-f]{4}){2,}$/i;

export const sanitizeDisplayName = (value: string | null | undefined, fallback = "User") => {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;

  const stripped = normalized.replace(TRAILING_IDENTIFIER_PATTERN, "").trim();
  return stripped || normalized || fallback;
};

