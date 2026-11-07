import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callPreflight, getRtcToken, startBridgeCall } from "@/lib/telephony.functions";
import { encodeState } from "@/lib/call-rules";
import { formatPhone } from "@/lib/leads";

type CallState = "idle" | "connecting" | "ringing" | "active";
type PhoneCtx = {
  ready: boolean;
  unavailable: string | null;
  state: CallState;
  leadId: string | null;
  muted: boolean;
  call: (lead: { id: string; name: string }) => Promise<void>;
  hangup: () => void;
  toggleMute: () => void;
};
const Ctx = createContext<PhoneCtx | null>(null);
export const usePhone = () => useContext(Ctx);

/** Browser calling (Telnyx WebRTC), loaded only in the browser after sign-in. */
export function PhoneProvider({ children }: { children: ReactNode }) {
  const tokenFn = useServerFn(getRtcToken);
  const preflight = useServerFn(callPreflight);
  const bridge = useServerFn(startBridgeCall);
  const qc = useQueryClient();
  const client = useRef<any>(null);
  const current = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [incoming, setIncoming] = useState<any>(null);

  const connect = useCallback(async () => {
    const r = await tokenFn();
    if ("error" in r && r.error) {
      setUnavailable(r.error);
      return;
    }
    const { TelnyxRTC } = await import("@telnyx/webrtc");
    const c = new TelnyxRTC({ login_token: (r as { token: string }).token });
    c.remoteElement = "calldesk-remote-audio";
    c.on("telnyx.ready", () => {
      setReady(true);
      setUnavailable(null);
    });
    c.on("telnyx.error", () => setUnavailable("Browser calling disconnected. Refresh to retry."));
    c.on("telnyx.socket.close", () => setReady(false));
    c.on("telnyx.notification", (n: any) => {
      if (n.type !== "callUpdate" || !n.call) return;
      const call = n.call;
      const s: string = call.state;
      if (call.direction === "inbound" && (s === "ringing" || s === "new")) {
        setIncoming(call);
        return;
      }
      if (s === "trying" || s === "requesting" || s === "early") setState("ringing");
      if (s === "active") {
        current.current = call;
        setState("active");
        setIncoming(null);
      }
      if (s === "hangup" || s === "destroy") {
        if (current.current === call || call.direction === "outbound") {
          current.current = null;
          setState("idle");
          setMuted(false);
          setTimeout(() => qc.invalidateQueries({ queryKey: ["leads"] }), 2500);
        }
        setIncoming((x: any) => (x === call ? null : x));
      }
    });
    c.connect();
    client.current = c;
  }, [tokenFn, qc]);

  useEffect(() => {
    connect().catch(() => setUnavailable("Browser calling couldn't start."));
    return () => {
      try {
        client.current?.disconnect();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const call = useCallback(
    async (lead: { id: string; name: string }) => {
      if (state !== "idle") {
        toast.error("You're already on a call.");
        return;
      }
      setState("connecting");
      setLeadId(lead.id);
      const pre = await preflight({ data: { leadId: lead.id } }).catch(() => null);
      if (!pre?.ok) {
        setState("idle");
        toast.error(pre?.reason ?? "Couldn't check this call.");
        return;
      }
      if (pre.mode === "bridge") {
        const r = await bridge({ data: { leadId: lead.id } });
        setState("idle");
        if ("error" in r && r.error) toast.error(r.error);
        else toast.success(`Calling your cell. Answer it and ${lead.name} will be dialed.`);
        return;
      }
      if (!client.current || !ready) {
        setState("idle");
        toast.error(unavailable ?? "Browser calling isn't connected yet.");
        return;
      }
      current.current = client.current.newCall({
        destinationNumber: pre.to,
        clientState: encodeState({ l: lead.id }),
        audio: true,
        video: false,
      });
      setState("ringing");
    },
    [state, preflight, bridge, ready, unavailable],
  );

  const hangup = useCallback(() => {
    try {
      current.current?.hangup();
    } catch {
      /* ignore */
    }
    setState("idle");
  }, []);
  const toggleMute = useCallback(() => {
    current.current?.toggleAudioMute();
    setMuted((m) => !m);
  }, []);

  return (
    <Ctx.Provider value={{ ready, unavailable, state, leadId, muted, call, hangup, toggleMute }}>
      {children}
      <audio id="calldesk-remote-audio" autoPlay className="hidden" />
      {incoming && (
        <div
          role="alertdialog"
          aria-label="Incoming call"
          className="fixed inset-x-0 top-16 z-50 mx-auto flex w-fit items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-card"
        >
          <Phone className="size-4 text-primary" />
          <span className="text-sm">
            Incoming call{" "}
            <span className="font-mono">
              {formatPhone(incoming.options?.remoteCallerNumber ?? "")}
            </span>
          </span>
          <Button
            size="sm"
            onClick={() => {
              incoming.answer();
              current.current = incoming;
              setIncoming(null);
            }}
          >
            Answer
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              incoming.hangup();
              setIncoming(null);
            }}
          >
            Decline
          </Button>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Call / hang up / mute control for a lead. */
export function CallControls({ lead }: { lead: { id: string; name: string } }) {
  const phone = usePhone();
  if (!phone) return null;
  const onThis = phone.leadId === lead.id && phone.state !== "idle";
  if (onThis) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {phone.state === "active"
            ? "On call"
            : phone.state === "ringing"
              ? "Ringing…"
              : "Checking…"}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={phone.toggleMute}
          aria-label={phone.muted ? "Unmute" : "Mute"}
        >
          {phone.muted ? <MicOff /> : <Mic />}
        </Button>
        <Button size="sm" variant="destructive" onClick={phone.hangup}>
          <PhoneOff /> Hang up
        </Button>
      </div>
    );
  }
  return (
    <Button
      variant="ember"
      size="sm"
      disabled={phone.state !== "idle"}
      onClick={() => phone.call(lead)}
      title={phone.unavailable ?? undefined}
    >
      <Phone /> Call
    </Button>
  );
}
