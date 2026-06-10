import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase, SUPABASE_STORAGE_KEY } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { createIdentityKeyPair, getStoredPrivateIdentityKey, serializePublicIdentityKey, storePrivateIdentityKey } from "@/lib/identity-keys";
import { getOrCreateDeviceId } from "@/lib/device-fingerprint";
import { sanitizeDisplayName } from "@/lib/profile-utils";
import { generateUUID } from "@/lib/utils";

type Profile = Tables<"profiles">;
type UserEncryptionIdentity = Tables<"user_encryption_identities">;
const PROFILE_CACHE_KEY = "yoobro-profile-cache";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  identityFingerprint: string | null;
  accessRestricted: boolean;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  continueAsGuest: (preferredName?: string, guestKey?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshIdentityFingerprint: () => Promise<void>;
}

interface StoredSessionLike {
  access_token?: string;
  refresh_token?: string;
}

const INTERNAL_AUTH_PREFIX = "yoobro";
const INTERNAL_AUTH_DOMAIN = "gmail.com";
const GUEST_CREDENTIALS_KEY = "yoobro-guest-credentials";

interface StoredGuestCredentials {
  email: string;
  password: string;
  displayName: string;
}

type StoredGuestCredentialsMap = Record<string, StoredGuestCredentials>;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [identityFingerprint, setIdentityFingerprint] = useState<string | null>(null);
  const [accessRestricted, setAccessRestricted] = useState(false);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const explicitSignOutRef = useRef(false);

  const readCachedProfile = (userId: string) => {
    try {
      const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
      if (!raw) return null;

      const cached = JSON.parse(raw) as Profile;
      return cached.user_id === userId ? cached : null;
    } catch {
      return null;
    }
  };

  const writeCachedProfile = (nextProfile: Profile | null) => {
    try {
      if (!nextProfile) {
        window.localStorage.removeItem(PROFILE_CACHE_KEY);
        return;
      }

      window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(nextProfile));
    } catch {
      // Ignore cache write failures so auth never blocks on storage.
    }
  };

  const normalizeAuthIdentifier = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailPattern.test(trimmed)) {
      return trimmed;
    }

    const slug = trimmed.replace(/[^a-z0-9._-]+/g, "");
    if (!slug) {
      throw new Error("Please enter an email or username");
    }

    return `${INTERNAL_AUTH_PREFIX}+${slug}@${INTERNAL_AUTH_DOMAIN}`;
  };

  const recoverStoredSession = async () => {
    try {
      const raw = window.localStorage.getItem(SUPABASE_STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as StoredSessionLike;
      if (!parsed.access_token || !parsed.refresh_token) return null;

      const { data, error } = await supabase.auth.setSession({
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token,
      });

      if (error) {
        return null;
      }

      return data.session;
    } catch {
      return null;
    }
  };

  const buildGuestCacheKey = (value?: string) => {
    const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return normalized || "default-guest";
  };

  const readGuestCredentialsMap = () => {
    try {
      const raw = window.localStorage.getItem(GUEST_CREDENTIALS_KEY);
      return raw ? (JSON.parse(raw) as StoredGuestCredentialsMap) : {};
    } catch {
      return {};
    }
  };

  const readGuestCredentials = (guestKey?: string) => {
    const credentialMap = readGuestCredentialsMap();
    return credentialMap[buildGuestCacheKey(guestKey)] ?? null;
  };

  const writeGuestCredentials = (credentials: StoredGuestCredentials | null, guestKey?: string) => {
    try {
      const credentialMap = readGuestCredentialsMap();
      const cacheKey = buildGuestCacheKey(guestKey);
      if (credentials) {
        credentialMap[cacheKey] = credentials;
      } else {
        delete credentialMap[cacheKey];
      }
      window.localStorage.setItem(GUEST_CREDENTIALS_KEY, JSON.stringify(credentialMap));
    } catch {
      // Ignore guest cache failures.
    }
  };

  const buildGuestIdentity = (preferredName?: string) => {
    const cleanedName = preferredName?.trim() || "Guest";
    const slugBase = cleanedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "guest";
    const guestId = generateUUID();
    const email = `${INTERNAL_AUTH_PREFIX}-guest+${slugBase}-${guestId}@${INTERNAL_AUTH_DOMAIN}`;
    const password = generateUUID() + generateUUID();
    const displayName = cleanedName.length > 32 ? cleanedName.slice(0, 32) : cleanedName;
    return { email, password, displayName };
  };

  const deriveDisplayName = (sessionUser: User, fallback = "User") => {
    const metadataName = typeof sessionUser.user_metadata?.display_name === "string"
      ? sessionUser.user_metadata.display_name.trim()
      : "";
    if (metadataName) return sanitizeDisplayName(metadataName, fallback).slice(0, 32);

    const emailPrefix = sessionUser.email
      ?.split("@")[0]
      ?.replace(/^yoobro(\+|-guest\+)/, "")
      .replace(/[-._]+/g, " ")
      .trim();

    if (emailPrefix) {
      return sanitizeDisplayName(emailPrefix, fallback).slice(0, 32);
    }

    return fallback;
  };

  const ensureProfile = async (userId: string, displayName: string) => {
    const cleanedDisplayName = sanitizeDisplayName(displayName);

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProfile) {
      const existingName = sanitizeDisplayName(existingProfile.display_name, cleanedDisplayName);
      if (existingName !== existingProfile.display_name) {
        const { data: repairedProfile, error: repairError } = await supabase
          .from("profiles")
          .update({ display_name: existingName, username: existingName })
          .eq("user_id", userId)
          .select("*")
          .single();

        if (repairError) throw repairError;
        setProfile(repairedProfile);
        writeCachedProfile(repairedProfile);
        return;
      }

      setProfile(existingProfile);
      writeCachedProfile(existingProfile);
      return;
    }

    const { data: codeData } = await supabase.rpc("generate_user_code");
    const userCode = codeData || Math.random().toString(36).substring(2, 10).toUpperCase();

    const { data: insertedProfile, error } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        display_name: cleanedDisplayName,
        username: cleanedDisplayName,
        user_code: userCode,
      })
      .select("*")
      .single();

    if (error) throw error;
    setProfile(insertedProfile);
    writeCachedProfile(insertedProfile);
  };

  const ensureIdentityKey = async (userId: string) => {
    const existingPrivateKey = getStoredPrivateIdentityKey(userId);
    const { data: existingIdentity } = await supabase
      .from("user_encryption_identities")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingPrivateKey && existingIdentity) {
      setIdentityFingerprint((existingIdentity as UserEncryptionIdentity).fingerprint);
      return;
    }

    const generatedIdentity = await createIdentityKeyPair();
    storePrivateIdentityKey(userId, generatedIdentity.privateJwk);

    const serializedPublicKey = serializePublicIdentityKey(generatedIdentity.publicJwk);

    const { data, error } = await supabase
      .from("user_encryption_identities")
      .upsert({
        user_id: userId,
        public_key: serializedPublicKey,
        fingerprint: generatedIdentity.fingerprint,
      }, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) throw error;
    setIdentityFingerprint((data as UserEncryptionIdentity).fingerprint);
  };

  const applySession = (nextSession: Session | null) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (nextSession?.user) {
      const cachedProfile = readCachedProfile(nextSession.user.id);
      if (cachedProfile) {
        setProfile(cachedProfile);
      } else {
        setProfile(null);
      }

      window.setTimeout(() => {
        void ensureOwnProfileForSession(nextSession.user);
        void ensureIdentityKey(nextSession.user.id);
        void enforceDevicePolicy(nextSession.user.id).catch((error) => {
          console.error("Device policy check failed", error);
        });
      }, 0);
    } else {
      setProfile(null);
      writeCachedProfile(null);
      setIdentityFingerprint(null);
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      const cleanedDisplayName = sanitizeDisplayName(data.display_name);

      if (cleanedDisplayName !== data.display_name) {
        const { data: repairedProfile, error: repairError } = await supabase
          .from("profiles")
          .update({ display_name: cleanedDisplayName, username: cleanedDisplayName })
          .eq("user_id", userId)
          .select("*")
          .single();

        if (!repairError && repairedProfile) {
          setProfile(repairedProfile);
          writeCachedProfile(repairedProfile);
          return repairedProfile;
        }
      }

      setProfile(data);
      writeCachedProfile(data);
      return data;
    }

    return null;
  };

  const ensureOwnProfileForSession = async (sessionUser: User) => {
    const existingProfile = await fetchProfile(sessionUser.id);
    if (existingProfile) return existingProfile;

    await ensureProfile(sessionUser.id, deriveDisplayName(sessionUser));
    return readCachedProfile(sessionUser.id);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const refreshIdentityFingerprint = async () => {
    if (!user) return;
    await ensureIdentityKey(user.id);
  };

  useEffect(() => {
    let isMounted = true;

    const handleAuthState = (event: AuthChangeEvent, nextSession: Session | null) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT") {
        if (!explicitSignOutRef.current && sessionRef.current) {
          setLoading(false);
          return;
        }
        explicitSignOutRef.current = false;
        applySession(null);
        setLoading(false);
        return;
      }

      if (nextSession) {
        applySession(nextSession);
        setLoading(false);
        return;
      }

      // Ignore transient null sessions unless we truly have no active session left.
      if (sessionRef.current) {
        setLoading(false);
        return;
      }

      applySession(null);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      handleAuthState
    );

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!isMounted) return;

      if (initialSession) {
        applySession(initialSession);
        setLoading(false);
        return;
      }

      const recoveredSession = await recoverStoredSession();
      if (!isMounted) return;

      if (recoveredSession) {
        applySession(recoveredSession);
      } else if (!sessionRef.current) {
        applySession(null);
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    const refreshInterval = window.setInterval(() => {
      void supabase.auth.refreshSession();
    }, 4 * 60 * 1000);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, [session]);

  const signUp = async (email: string, password: string, displayName: string) => {
    explicitSignOutRef.current = false;
    const authIdentifier = normalizeAuthIdentifier(email);

    const { data, error } = await supabase.auth.signUp({
      email: authIdentifier,
      password,
      options: {
        data: {
          display_name: sanitizeDisplayName(displayName.trim()),
        },
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Signup failed");

    await enforceDevicePolicy(data.user.id);
    await ensureProfile(data.user.id, sanitizeDisplayName(displayName));
  };

  const signIn = async (email: string, password: string) => {
    explicitSignOutRef.current = false;
    const authIdentifier = normalizeAuthIdentifier(email);
    const { data, error } = await supabase.auth.signInWithPassword({ email: authIdentifier, password });
    if (error) throw error;
    if (!data.user) throw new Error("Sign in failed");
    await enforceDevicePolicy(data.user.id);
  };

  const continueAsGuest = async (preferredName?: string, guestKey?: string) => {
    explicitSignOutRef.current = false;

    const cachedGuest = readGuestCredentials(guestKey);
    const guestCredentials = cachedGuest ?? buildGuestIdentity(preferredName);

    let sessionUserId: string | null = null;

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: guestCredentials.email,
      password: guestCredentials.password,
    });

    if (loginError) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: guestCredentials.email,
        password: guestCredentials.password,
        options: {
          data: {
            display_name: guestCredentials.displayName,
          },
        },
      });

      if (signUpError) throw signUpError;
      sessionUserId = signUpData.user?.id ?? null;
    } else {
      sessionUserId = loginData.user?.id ?? null;
    }

    if (!sessionUserId) {
      throw new Error("Unable to create guest access right now");
    }

    await enforceDevicePolicy(sessionUserId);
    writeGuestCredentials(guestCredentials, guestKey ?? preferredName);
    await ensureProfile(sessionUserId, guestCredentials.displayName);
  };

  const signOut = async () => {
    explicitSignOutRef.current = true;
    await supabase.auth.signOut();
    setProfile(null);
    writeCachedProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, identityFingerprint, accessRestricted, loading, signUp, signIn, continueAsGuest, signOut, refreshProfile, refreshIdentityFingerprint }}>
      {children}
    </AuthContext.Provider>
  );
};
  const buildDeviceMetadata = (userId: string, deviceId: string) => ({
    user_id: userId,
    device_id: deviceId,
    user_agent: navigator.userAgent || null,
    platform: navigator.platform || null,
    language: navigator.language || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    screen_resolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    last_seen_at: new Date().toISOString(),
  });

  const enforceDevicePolicy = async (userId: string) => {
    const deviceId = await getOrCreateDeviceId();

    const { data: blockedDeviceRecord, error: blockedDeviceError } = await supabase
      .from("blocked_devices")
      .select("id")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (blockedDeviceError) throw blockedDeviceError;

    if (blockedDeviceRecord) {
      setAccessRestricted(true);
      explicitSignOutRef.current = true;
      await supabase.auth.signOut();
      applySession(null);
      throw new Error("Access restricted due to policy violation");
    }

    const { error: deviceUpsertError } = await supabase
      .from("user_devices")
      .upsert(buildDeviceMetadata(userId, deviceId), { onConflict: "user_id,device_id" });

    if (deviceUpsertError) throw deviceUpsertError;

    const { error: profileDeviceError } = await supabase
      .from("profiles")
      .update({ device_id: deviceId })
      .eq("user_id", userId);

    if (profileDeviceError) throw profileDeviceError;

    setAccessRestricted(false);
    return deviceId;
  };
