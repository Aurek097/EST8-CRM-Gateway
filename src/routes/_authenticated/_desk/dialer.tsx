import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/shell";
import { LeadQueue } from "@/components/lead-queue";
import { LeadCard, LicenseBadge } from "@/components/lead-card";
import { ImportDialog } from "@/components/import-dialog";
import { AddLeadDialog } from "@/components/add-lead-dialog";
import { TypeTag } from "@/components/lead-bits";
import { useLeadActions, useLeads } from "@/lib/use-leads";
import {
  applyOutcome,
  fieldPatch,
  formatPhone,
  fullName,
  stateCode,
  US_STATES,
  type LeadRow,
} from "@/lib/leads";
import { stageLabel, stageTone } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { ScriptView } from "@/components/script/script-view";
import { Playbook } from "@/components/script/playbook";
import { opener } from "@/scripts/engine";
import { CallControls } from "@/lib/phone";
import { TextThread } from "@/components/text-thread";

export const Route = createFileRoute("/_authenticated/_desk/dialer")({
  validateSearch: (s: Record<string, unknown>): { lead?: string | undefined } => ({
    lead: typeof s["lead"] === "string" ? s["lead"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Dialer · EST8 CallDesk" },
      { name: "description", content: "Lead queue, live script and lead card side by side." },
      { property: "og:title", content: "Dialer · EST8 CallDesk" },
      {
        property: "og:description",
        content: "Lead queue, live script and lead card side by side.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dialer,
});

function ageLabel(l: LeadRow) {
  const t = l.lead_date ?? l.created_at;
  const h = (Date.now() - new Date(t).getTime()) / 36e5;
  if (h < 1) return "just in";
  if (h < 48) return `${Math.floor(h)} hours old`;
  return `${Math.floor(h / 24)} days old`;
}

function Dialer() {
  const { lead: selectedId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: leads = [], isLoading } = useLeads();
  const { update, remove } = useLeadActions();
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const lead = leads.find((l) => l.id === selectedId) ?? null;
  const select = (id?: string) => navigate({ search: { lead: id }, replace: true });

  const outcome = (o: "noanswer" | "voicemail" | "text" | "talked") => {
    if (!lead) return;
    if (lead.status === "dnc" && o !== "talked") {
      toast.error("Do not call. Dialing and texting are blocked.");
      return;
    }
    update(lead.id, applyOutcome(lead, o));
    toast.success("Dial logged");
  };

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[272px_minmax(0,780px)_340px] lg:justify-center">
      <aside className="lg:sticky lg:top-18 lg:self-start">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading leads…</p>
        ) : (
          <LeadQueue
            leads={leads}
            selectedId={selectedId}
            onSelect={select}
            onImport={() => setImportOpen(true)}
            onAdd={() => setAddOpen(true)}
            onRemoveSamples={() => {
              remove(leads.filter((l) => l.sample).map((l) => l.id));
              toast.success("Sample leads removed");
            }}
          />
        )}
      </aside>

      <section className="min-w-0 space-y-4">
        {!lead ? (
          <Empty
            title={leads.length ? "Pick a lead" : "No leads yet"}
            body={
              leads.length
                ? "Choose someone from the queue to load their script and card."
                : "Import a spreadsheet or add a lead to fill your queue."
            }
          >
            {!leads.length && (
              <Button variant="ember" className="mt-3" onClick={() => setImportOpen(true)}>
                Import spreadsheet
              </Button>
            )}
          </Empty>
        ) : (
          <>
            <div className="rounded-xl border bg-card p-6 shadow-card">
              <p className="eyebrow">
                {lead.lead_type === "fe"
                  ? `Final expense · one call · ${ageLabel(lead)}`
                  : `Step ${lead.step} of 2 · ${lead.step === 1 ? "Phone call" : "Presentation"}`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <TypeTag type={lead.lead_type} />
                <h1 className="text-3xl font-bold text-primary">{fullName(lead)}</h1>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    stageTone(lead.status),
                  )}
                >
                  {stageLabel(lead.status)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono text-foreground">{formatPhone(lead.phone)}</span>
                <span>
                  {[lead.city, US_STATES[stateCode(lead.state) ?? ""] ?? lead.state]
                    .filter(Boolean)
                    .join(", ")}
                </span>
                <LicenseBadge state={lead.state} />
                <span className="ml-auto">
                  <CallControls lead={{ id: lead.id, name: fullName(lead) }} />
                </span>
              </div>
              <div className="mt-4 flex gap-1.5 font-display text-lg font-bold">
                {(lead.lead_type === "fe" ? "COWFHQPAL" : lead.step === 1 ? "BEST" : "REAL")
                  .split("")
                  .map((l, i) => (
                    <span
                      key={i}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md",
                        lead.lead_type === "fe" ? "bg-fe-soft text-fe" : "bg-mp-soft text-mp",
                      )}
                    >
                      {l}
                    </span>
                  ))}
              </div>
              {lead.lead_type === "fe" && (
                <div className="mt-3 flex gap-1 text-xs">
                  {(["A", "B"] as const).map((o) => (
                    <button
                      key={o}
                      onClick={() =>
                        update(
                          lead.id,
                          fieldPatch(
                            lead,
                            "opener",
                            o === "A" ? "Opener A · fresh" : "Opener B · aged",
                          ),
                        )
                      }
                      className={cn(
                        "rounded-full px-3 py-1",
                        opener(lead) === o
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      Opener {o} · {o === "A" ? "fresh" : "aged"}
                    </button>
                  ))}
                </div>
              )}
              {lead.lead_type === "mp" && (
                <div className="mt-3 flex gap-1 text-xs">
                  {[1, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => update(lead.id, { step: s })}
                      className={cn(
                        "rounded-full px-3 py-1",
                        lead.step === s
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      Step {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ScriptView lead={lead} onChange={(p) => update(lead.id, p)} onOutcome={outcome} />
          </>
        )}
      </section>

      <aside className="lg:sticky lg:top-18 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto">
        {lead ? (
          <LeadCard
            key={lead.id}
            lead={lead}
            onChange={(p) => update(lead.id, p)}
            extra={
              <>
                <TextThread lead={lead} />
                <Playbook lead={lead} />
              </>
            }
            onDelete={() => {
              remove([lead.id]);
              select(undefined);
              toast.success("Lead deleted");
            }}
          />
        ) : (
          <Empty
            title="Lead card"
            body="Pick a lead to see its details, stage, verification and notes."
          />
        )}
      </aside>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <AddLeadDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => {}} />
    </div>
  );
}
