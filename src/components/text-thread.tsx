import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendSms } from "@/lib/telephony.functions";
import { cn } from "@/lib/utils";
import type { LeadRow } from "@/lib/leads";
import { Section } from "@/components/lead-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Text thread with a lead. The first text gets "Reply STOP to opt out." */
export function TextThread({ lead }: { lead: LeadRow }) {
  const qc = useQueryClient();
  const send = useServerFn(sendSms);
  const key = ["sms", lead.id];
  const { data: msgs = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await supabase.from("sms_messages").select("*").eq("lead_id", lead.id).order("created_at"))
        .data ?? [],
    refetchInterval: 15000,
  });
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [promotional, setPromotional] = useState(true);
  const blocked =
    lead.status === "dnc"
      ? "Do not call: texting is blocked."
      : lead.sms_opt_out
        ? "This lead replied STOP."
        : null;
  const first = !msgs.some((m) => m.direction === "outbound");

  const submit = async () => {
    const text =
      first && !/reply stop/i.test(body) ? `${body.trim()} Reply STOP to opt out.` : body.trim();
    setBusy(true);
    const r = await send({ data: { leadId: lead.id, body: text, promotional } }).catch(() => ({
      error: "Couldn't send.",
    }));
    setBusy(false);
    if ("error" in r && r.error) {
      toast.error(r.error);
      return;
    }
    setBody("");
    toast.success("Text sent");
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["leads"] });
  };

  return (
    <Section title="Texts">
      <div className="max-h-56 space-y-1.5 overflow-y-auto">
        {msgs.length === 0 && <p className="text-xs text-muted-foreground">No texts yet.</p>}
        {msgs.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm",
              m.direction === "outbound"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted",
            )}
          >
            {m.body}
            <p className="mt-0.5 text-[10px] opacity-70">
              {new Date(m.created_at).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {m.direction === "outbound" ? ` · ${m.status}` : ""}
            </p>
          </div>
        ))}
      </div>
      {blocked ? (
        <p className="text-xs font-semibold text-danger">{blocked}</p>
      ) : (
        <div className="space-y-1.5">
          <select
            aria-label="Message category"
            value={promotional ? "marketing" : "service"}
            onChange={(e) => setPromotional(e.target.value === "marketing")}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="marketing">Marketing / promotional (separate consent)</option>
            <option value="service">Requested inquiry / appointment / service</option>
          </select>
          <Textarea
            aria-label="Text message"
            rows={2}
            maxLength={1450}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a text. Never send pricing by text."
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {first ? 'Adds "Reply STOP to opt out."' : `${body.length}/1500`}
            </span>
            <Button size="sm" onClick={submit} disabled={busy || !body.trim()}>
              <Send /> Send
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}
