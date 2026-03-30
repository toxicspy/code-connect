import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type CallType = "voice" | "video";
type CallStatus = "idle" | "ringing" | "connected";
type Permission = "allow" | "block";

interface IncomingCall {
  fromUserId: string;
  fromName: string;
  callType: CallType;
  offer: RTCSessionDescriptionInit;
}

interface ActiveCall {
  peerUserId: string;
  peerName: string;
  callType: CallType;
  status: CallStatus;
  startedAt: number | null;
}

interface StartCallParams {
  targetUserId: string;
  targetName: string;
  callType: CallType;
}

interface CallContextValue {
  incomingCall: IncomingCall | null;
  activeCall: ActiveCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraEnabled: boolean;
  startCall: (params: StartCallParams) => Promise<void>;
  acceptIncomingCall: (permission: Permission) => Promise<void>;
  rejectIncomingCall: (reason?: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}

const CALL_SIGNALING_URL = import.meta.env.VITE_CALL_SIGNALING_URL || "http://127.0.0.1:3001";
const CALL_COOLDOWN_MS = 20_000;
const DEFAULT_TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME;
const DEFAULT_TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL;
const DEFAULT_TURN_URL = import.meta.env.VITE_TURN_URL;

const CallContext = createContext<CallContextValue | undefined>(undefined);

const getPermissionStorageKey = (userId: string, otherUserId: string) => `yoobro-call-permission:${userId}:${otherUserId}`;
const getCooldownStorageKey = (userId: string, otherUserId: string) => `yoobro-call-cooldown:${userId}:${otherUserId}`;

const iceServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  ...(DEFAULT_TURN_URL && DEFAULT_TURN_USERNAME && DEFAULT_TURN_CREDENTIAL
    ? [{
        urls: DEFAULT_TURN_URL,
        username: DEFAULT_TURN_USERNAME,
        credential: DEFAULT_TURN_CREDENTIAL,
      }]
    : []),
];

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, profile } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const peerMetaRef = useRef<{ peerUserId: string; peerName: string; callType: CallType } | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    busyRef.current = Boolean(activeCall || incomingCall);
  }, [activeCall, incomingCall]);

  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraEnabled(true);
  }, []);

  const cleanupPeer = useCallback(() => {
    queuedCandidatesRef.current = [];
    peerRef.current?.close();
    peerRef.current = null;
    peerMetaRef.current = null;
  }, []);

  const resetCallState = useCallback(() => {
    cleanupPeer();
    cleanupMedia();
    setIncomingCall(null);
    setActiveCall(null);
  }, [cleanupMedia, cleanupPeer]);

  const createPeerConnection = useCallback((peerUserId: string, peerName: string, callType: CallType) => {
    const peer = new RTCPeerConnection({ iceServers });

    peer.onicecandidate = (event) => {
      if (!event.candidate || !user) return;
      socketRef.current?.emit("iceCandidate", {
        toUserId: peerUserId,
        fromUserId: user.id,
        candidate: event.candidate.toJSON(),
      });
    };

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) setRemoteStream(stream);
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        setActiveCall((current) => current ? { ...current, status: "connected", startedAt: current.startedAt ?? Date.now() } : current);
      }

      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
        toast.info("Call ended");
        resetCallState();
      }
    };

    localStreamRef.current?.getTracks().forEach((track) => peer.addTrack(track, localStreamRef.current as MediaStream));
    peerMetaRef.current = { peerUserId, peerName, callType };
    peerRef.current = peer;
    return peer;
  }, [resetCallState, user]);

  const flushQueuedCandidates = useCallback(async () => {
    if (!peerRef.current || queuedCandidatesRef.current.length === 0) return;
    const queued = [...queuedCandidatesRef.current];
    queuedCandidatesRef.current = [];
    for (const candidate of queued) {
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Failed to add queued ICE candidate", error);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      resetCallState();
      return;
    }

    const socket = io(CALL_SIGNALING_URL, {
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("registerUser", {
        userId: user.id,
        displayName: profile?.display_name || "Unknown",
      });
    });

    socket.on("incomingCall", (payload: IncomingCall) => {
      if (!user) return;
      const permission = window.localStorage.getItem(getPermissionStorageKey(user.id, payload.fromUserId));
      if (permission === "block") {
        socket.emit("rejectCall", {
          toUserId: payload.fromUserId,
          fromUserId: user.id,
          reason: "blocked",
        });
        return;
      }

      if (busyRef.current) {
        socket.emit("rejectCall", {
          toUserId: payload.fromUserId,
          fromUserId: user.id,
          reason: "busy",
        });
        return;
      }

      setIncomingCall(payload);
      toast.info(`Incoming ${payload.callType} call from ${payload.fromName}`);
    });

    socket.on("callAccepted", async ({ fromUserId, answer, callType }) => {
      if (!peerRef.current) return;
      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        await flushQueuedCandidates();
        const meta = peerMetaRef.current;
        setActiveCall((current) => ({
          peerUserId: fromUserId,
          peerName: meta?.peerName || "Unknown",
          callType: callType || meta?.callType || "voice",
          status: "connected",
          startedAt: Date.now(),
        }));
      } catch (error) {
        console.error("Failed to accept answer", error);
        toast.error("Failed to connect call");
        resetCallState();
      }
    });

    socket.on("callRejected", ({ reason }) => {
      const message =
        reason === "blocked" ? "Calls from you are blocked by this user." :
        reason === "busy" ? "User is already in another call." :
        reason === "offline" ? "User is offline right now." :
        "Call rejected";
      toast.error(message);
      resetCallState();
    });

    socket.on("callUnavailable", ({ reason }) => {
      toast.error(reason === "offline" ? "User is offline right now." : "Call unavailable");
      resetCallState();
    });

    socket.on("callEnded", () => {
      toast.info("Call ended");
      resetCallState();
    });

    socket.on("iceCandidate", async ({ candidate }) => {
      if (!peerRef.current?.remoteDescription) {
        queuedCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Failed to add ICE candidate", error);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [flushQueuedCandidates, profile?.display_name, resetCallState, user]);

  const startCall = useCallback(async ({ targetUserId, targetName, callType }: StartCallParams) => {
    if (!user || !socketRef.current) return;
    if (activeCall || incomingCall) {
      toast.error("Finish the current call first.");
      return;
    }

    const lastCallAt = Number(window.localStorage.getItem(getCooldownStorageKey(user.id, targetUserId)) || 0);
    if (Date.now() - lastCallAt < CALL_COOLDOWN_MS) {
      toast.error("Please wait a bit before calling again.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraEnabled(callType === "video");

      const peer = createPeerConnection(targetUserId, targetName, callType);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      setActiveCall({
        peerUserId: targetUserId,
        peerName: targetName,
        callType,
        status: "ringing",
        startedAt: null,
      });

      window.localStorage.setItem(getCooldownStorageKey(user.id, targetUserId), String(Date.now()));

      socketRef.current.emit("callUser", {
        toUserId: targetUserId,
        fromUserId: user.id,
        fromName: profile?.display_name || profile?.user_code || "Unknown",
        callType,
        offer,
      });
    } catch (error) {
      console.error("Failed to start call", error);
      toast.error("Microphone or camera permission was denied.");
      resetCallState();
    }
  }, [activeCall, createPeerConnection, incomingCall, profile?.display_name, profile?.user_code, resetCallState, user]);

  const acceptIncomingCall = useCallback(async (permission: Permission) => {
    if (!user || !incomingCall || !socketRef.current) return;

    window.localStorage.setItem(getPermissionStorageKey(user.id, incomingCall.fromUserId), permission);
    if (permission === "block") {
      socketRef.current.emit("rejectCall", {
        toUserId: incomingCall.fromUserId,
        fromUserId: user.id,
        reason: "blocked",
      });
      setIncomingCall(null);
      toast.info("Caller blocked");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.callType === "video",
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraEnabled(incomingCall.callType === "video");

      const peer = createPeerConnection(incomingCall.fromUserId, incomingCall.fromName, incomingCall.callType);
      await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      await flushQueuedCandidates();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      setActiveCall({
        peerUserId: incomingCall.fromUserId,
        peerName: incomingCall.fromName,
        callType: incomingCall.callType,
        status: "connected",
        startedAt: Date.now(),
      });

      socketRef.current.emit("acceptCall", {
        toUserId: incomingCall.fromUserId,
        fromUserId: user.id,
        answer,
        callType: incomingCall.callType,
      });

      setIncomingCall(null);
    } catch (error) {
      console.error("Failed to accept call", error);
      toast.error("Could not start the call");
      resetCallState();
    }
  }, [createPeerConnection, flushQueuedCandidates, incomingCall, resetCallState, user]);

  const rejectIncomingCall = useCallback((reason = "rejected") => {
    if (!user || !incomingCall || !socketRef.current) return;
    socketRef.current.emit("rejectCall", {
      toUserId: incomingCall.fromUserId,
      fromUserId: user.id,
      reason,
    });
    setIncomingCall(null);
  }, [incomingCall, user]);

  const endCall = useCallback(() => {
    if (user && activeCall && socketRef.current) {
      socketRef.current.emit("endCall", {
        toUserId: activeCall.peerUserId,
        fromUserId: user.id,
      });
    }
    resetCallState();
  }, [activeCall, resetCallState, user]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const nextEnabled = !isCameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsCameraEnabled(nextEnabled);
  }, [isCameraEnabled]);

  const value = useMemo(() => ({
    incomingCall,
    activeCall,
    localStream,
    remoteStream,
    isMuted,
    isCameraEnabled,
    startCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
  }), [acceptIncomingCall, activeCall, endCall, incomingCall, isCameraEnabled, isMuted, localStream, rejectIncomingCall, remoteStream, startCall, toggleCamera, toggleMute]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};
