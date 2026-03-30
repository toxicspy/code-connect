import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Shield } from "lucide-react";
import { useCall } from "@/contexts/CallContext";
import { Button } from "@/components/ui/button";

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const CallOverlay = () => {
  const {
    incomingCall,
    activeCall,
    localStream,
    remoteStream,
    isMuted,
    isCameraEnabled,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!activeCall?.startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - activeCall.startedAt!) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [activeCall?.startedAt]);

  const statusText = useMemo(() => {
    if (!activeCall) return "";
    if (activeCall.status === "ringing") return activeCall.callType === "video" ? "Ringing video call..." : "Ringing voice call...";
    return formatDuration(elapsedSeconds);
  }, [activeCall, elapsedSeconds]);

  const showActiveOverlay = Boolean(activeCall);

  return (
    <>
      {incomingCall && !activeCall && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                {incomingCall.callType === "video" ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Incoming {incomingCall.callType} call</p>
                <h3 className="truncate text-lg font-semibold">{incomingCall.fromName}</h3>
              </div>
            </div>
            <div className="mb-4 rounded-2xl border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Allow calls from this user?
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => rejectIncomingCall()}>
                Reject
              </Button>
              <Button type="button" className="rounded-xl" onClick={() => acceptIncomingCall("allow")}>
                Accept
              </Button>
              <Button type="button" variant="destructive" className="rounded-xl" onClick={() => acceptIncomingCall("block")}>
                Block
              </Button>
            </div>
          </div>
        </div>
      )}

      {showActiveOverlay && activeCall && (
        <div className="fixed inset-0 z-[80] bg-background">
          <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-background via-background to-muted/30">
            <div className="px-4 pb-4 pt-6 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">secure call</p>
              <h2 className="mt-2 text-2xl font-semibold">{activeCall.peerName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{statusText}</p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                {activeCall.callType === "video" ? "Video call" : "Voice call"}
              </div>
            </div>

            <div className="relative flex-1 p-4">
              {activeCall.callType === "video" ? (
                <div className="grid h-full min-h-0 grid-rows-[1fr_auto] gap-3 md:grid-cols-[1fr_280px] md:grid-rows-1">
                  <div className="relative overflow-hidden rounded-3xl border bg-black">
                    {remoteStream ? (
                      <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-white/70">Waiting for video...</div>
                    )}
                  </div>
                  <div className="relative h-40 overflow-hidden rounded-3xl border bg-black md:h-full">
                    {localStream ? (
                      <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-white/70">Camera preview</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="flex h-44 w-44 items-center justify-center rounded-full bg-primary/10 text-primary shadow-xl shadow-primary/20">
                    <Phone className="h-16 w-16" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
              <Button type="button" variant="outline" size="icon" className="h-14 w-14 rounded-full" onClick={toggleMute}>
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              {activeCall.callType === "video" && (
                <Button type="button" variant="outline" size="icon" className="h-14 w-14 rounded-full" onClick={toggleCamera}>
                  {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
              )}
              <Button type="button" size="icon" className="h-16 w-16 rounded-full bg-red-500 text-white hover:bg-red-600" onClick={endCall}>
                <PhoneOff className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CallOverlay;
