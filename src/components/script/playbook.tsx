import { toast } from "sonner";
import { Copy } from "lucide-react";
import type { LeadRow } from "@/lib/leads";
import { useDesk } from "@/lib/desk";
import { opener, type Ctx } from "@/scripts/engine";
import { POWER_PHRASES } from "@/scripts/mp-step1";
import { OBJECTIONS, TEMPLATES } from "@/scripts/fe";
import { Rich, plainText } from "./script-view";
import { Section } from "@/components/lead-card";

export function Playbook({ lead }: { lead: LeadRow }) {
  const { me } = useDesk();
  const ctx: Ctx = { lead, me, now: new Date() };
  const api = { ctx, set: () => {}, patch: () => {}, outcome: () => {} };

  if (lead.lead_type === "mp") {
    if (lead.step !== 1) return null;
    return (
      <Section title="Power phrases">
        <ul className="space-y-1.5 text-sm">
          {POWER_PHRASES.map((p, i) => (
            <li key={i}>
              <Rich text={p} api={api} />
            </li>
          ))}
        </ul>
      </Section>
    );
  }
  const o = opener(lead, ctx.now);
  return (
    <>
      <Section title="Objection handlers">
        <p className="text-xs text-muted-foreground">
          Acknowledge it, ask one question to find the real concern, then return to the three
          options. Two honest attempts, then respect the no and set a follow-up.
        </p>
        <div className="space-y-1">
          {OBJECTIONS.map(([say, behind, reply]) => (
            <details key={say} className="rounded-lg border p-2 text-sm">
              <summary className="cursor-pointer font-semibold">{say}</summary>
              <p className="mt-1 text-xs text-muted-foreground">{behind}</p>
              <p className="mt-1">
                "<Rich text={reply} api={api} />"
              </p>
            </details>
          ))}
        </div>
      </Section>
      <Section title={`Voicemail and texts · Opener ${o}`}>
        <p className="text-xs text-muted-foreground">
          Voicemails under 20 seconds, number twice. Text only leads whose consent covers texting;
          never send pricing by text.
        </p>
        <div className="space-y-2">
          {TEMPLATES.filter((t) => t.opener === o).map((t) => (
            <div key={t.when} className="rounded-lg border p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{t.when}</span>
                <button
                  aria-label="Copy"
                  className="text-muted-foreground hover:text-primary"
                  onClick={() => {
                    navigator.clipboard.writeText(plainText(t.text, ctx));
                    toast.success("Copied");
                  }}
                >
                  <Copy className="size-4" />
                </button>
              </div>
              <p className="mt-1">
                <Rich text={t.text} api={api} />
              </p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
