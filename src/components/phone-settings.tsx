import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDesk } from "@/lib/desk";
import { cn } from "@/lib/utils";
import { a2pStatus, diagnostics } from "@/lib/telephony.functions";
import { Panel } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Stable published address Telnyx and lead vendors call. */
export const APP_URL = "https://est8-symmetry-gateway.lovable.app";
const copy = (v: string) => {
  navigator.clipboard.writeText(v);
  toast.success("Copied");
};

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold">{label}</p>
      <div className="flex items-center gap-1">
        <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 font-mono text-xs">
          {value}
        </code>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Copy ${label}`}
          onClick={() => copy(value)}
        >
          <Copy />
        </Button>
      </div>
    </div>
  );
}

export function CallingSettings() {
  const { me } = useDesk();
  const qc = useQueryClient();
  const { data: cfg } = useQuery({
    queryKey: ["tcfg", me.id],
    queryFn: async () =>
      (await supabase.from("telephony_configs").select("*").eq("user_id", me.id).maybeSingle())
        .data,
  });
  const [f, setF] = useState({
    calling_mode: "webrtc",
    bridge_phone: "",
    primary_caller_id: "",
    record_calls: false,
  });
  useEffect(() => {
    if (cfg)
      setF({
        calling_mode: cfg.calling_mode,
        bridge_phone: cfg.bridge_phone ?? "",
        primary_caller_id: cfg.primary_caller_id ?? "",
        record_calls: cfg.record_calls,
      });
  }, [cfg]);
  const save = async () => {
    const { error } = await supabase.from("telephony_configs").upsert({
      user_id: me.id,
      calling_mode: f.calling_mode,
      bridge_phone: f.bridge_phone || null,
      primary_caller_id: f.primary_caller_id || null,
      record_calls: f.record_calls,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      toast.error("Couldn't save");
      return;
    }
    toast.success("Calling settings saved");
    qc.invalidateQueries({ queryKey: ["tcfg", me.id] });
  };
  return (
    <Panel title="Calling">
      <div className="space-y-4">
        <div className="flex gap-1 text-sm">
          {(
            [
              ["webrtc", "Browser (headset)"],
              ["bridge", "Cell Bridge"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setF({ ...f, calling_mode: v })}
              className={cn(
                "rounded-full px-3 py-1.5",
                f.calling_mode === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {f.calling_mode === "bridge"
            ? "CallDesk rings your cell first. When you answer, it dials the lead."
            : "Calls go through your computer's microphone and speakers. A headset is best."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-bridge">Cell Bridge number</Label>
            <Input
              id="c-bridge"
              className="font-mono"
              value={f.bridge_phone}
              onChange={(e) => setF({ ...f, bridge_phone: e.target.value })}
              placeholder="Uses your Profile phone if blank"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-cid">Primary caller ID</Label>
            <Input
              id="c-cid"
              className="font-mono"
              value={f.primary_caller_id}
              onChange={(e) => setF({ ...f, primary_caller_id: e.target.value })}
              placeholder="+1…"
            />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Switch
            id="c-rec"
            checked={f.record_calls}
            onCheckedChange={(c) => setF({ ...f, record_calls: c })}
          />
          <Label htmlFor="c-rec" className="font-normal leading-snug">
            Record calls
            <span className="block text-xs text-muted-foreground">
              Say "This call may be recorded for quality" in your opener. Recording links are saved
              on the lead.
            </span>
          </Label>
        </div>
        <Button onClick={save}>Save calling settings</Button>
      </div>
    </Panel>
  );
}

export function A2PPanel() {
  const fn = useServerFn(a2pStatus);
  const { data, isFetching, refetch } = useQuery({ queryKey: ["a2p"], queryFn: () => fn() });
  const tone = (s: string) =>
    /verified|active|approved|registered/i.test(s)
      ? "bg-success-soft text-success"
      : /fail|reject|denied/i.test(s)
        ? "bg-danger-soft text-danger"
        : "bg-warning-soft text-warning";
  return (
    <Panel title="A2P 10DLC texting registration">
      <p className="mb-3 text-sm text-muted-foreground">
        Register the actual legal business responsible for your messages. Voice calling is
        independent of texting approval.
      </p>
      <Button asChild variant="outline" className="mb-4">
        <Link to="/a2p">A2P Registration</Link>
      </Button>
      {data?.error && <p className="mb-2 text-sm text-danger">{data.error}</p>}
      {!data?.configured ? (
        <p className="text-sm">Phone service isn't connected yet.</p>
      ) : (
        <div className="space-y-1.5 text-sm">
          {data.brands.length === 0 && <p>No brand registered yet.</p>}
          {data.brands.map((b: { name: string; status: string }, i: number) => (
            <p key={i}>
              Brand · {b.name}{" "}
              <span
                className={cn(
                  "ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  tone(b.status),
                )}
              >
                {b.status}
              </span>
            </p>
          ))}
          {data.campaigns.map((c: { name: string; status: string }, i: number) => (
            <p key={i}>
              Campaign · {c.name}{" "}
              <span
                className={cn(
                  "ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  tone(c.status),
                )}
              >
                {c.status}
              </span>
            </p>
          ))}
        </div>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="mt-2"
        onClick={() => refetch()}
        disabled={isFetching}
      >
        <RefreshCw /> Refresh
      </Button>
    </Panel>
  );
}

export function IntakePanel() {
  const { me } = useDesk();
  const key = (me as { intake_key?: string }).intake_key;
  if (!key) return null;
  const url = `${APP_URL}/api/public/lead-intake?key=${key}`;
  return (
    <Panel title="Live lead intake">
      <p className="mb-3 text-sm text-muted-foreground">
        Give this private address to lead vendors or your own website and Facebook forms. Each lead
        posted to it lands in your queue as New, and you get a fresh-lead alert. Keep it private:
        anyone with it can add leads.
      </p>
      <CopyRow label="Your intake address (POST JSON or form data)" value={url} />
      <p className="mt-2 text-xs text-muted-foreground">
        Fields: first_name, last_name, phone, email, address, city, state, zip, lead_type (mp or
        fe), source, trusted_form, dob, loan_amount, lender, amount_requested, beneficiary, notes.
      </p>
    </Panel>
  );
}

export function DiagnosticsPanel() {
  const fn = useServerFn(diagnostics);
  const { data } = useQuery({ queryKey: ["diag"], queryFn: () => fn() });
  return (
    <Panel title="Phone system (admin)">
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {data &&
          "secrets" in data &&
          data.secrets?.map((s) => (
            <p key={s.name} className="flex justify-between font-mono text-xs">
              <span>{s.name}</span>
              <span className={s.set ? "text-success" : "text-warning"}>
                {s.set ? "set" : "missing"}
              </span>
            </p>
          ))}
      </div>
      {data && "apiOk" in data && data.apiOk !== null && (
        <p className={cn("mt-2 text-sm", data.apiOk ? "text-success" : "text-danger")}>
          {data.apiOk ? "Telnyx API key works." : "Telnyx rejected the API key."}
        </p>
      )}
      <div className="mt-4 space-y-3">
        <CopyRow
          label="Call Control app and SIP connection webhook URL"
          value={`${APP_URL}/api/public/telephony/voice-events`}
        />
        <CopyRow
          label="Messaging profile webhook URL"
          value={`${APP_URL}/api/public/telephony/sms-events`}
        />
      </div>
      <CopyRow
        label="A2P registration status webhook URL"
        value={`${APP_URL}/api/public/telephony/a2p-events`}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Publish updates before using new addresses with Telnyx.
      </p>
    </Panel>
  );
}
