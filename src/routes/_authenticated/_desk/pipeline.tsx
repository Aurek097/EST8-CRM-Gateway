import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useLeadActions, useLeads } from "@/lib/use-leads";
import { STAGES, PARKED, nextStage, stageLabel } from "@/lib/stages";
import { stagePatch } from "@/lib/lead-mutations";
import { formatPhone, fullName, premium, type LeadRow } from "@/lib/leads";
import { PageHeader, Panel } from "@/components/shell";
import { TypeTag } from "@/components/lead-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_desk/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline · EST8 CallDesk" },
      {
        name: "description",
        content: "Every lead by stage, with follow-ups due and premium totals.",
      },
      { property: "og:title", content: "Pipeline · EST8 CallDesk" },
      {
        property: "og:description",
        content: "Every lead by stage, with follow-ups due and premium totals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pipeline,
});

const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`;
const PARKED_KEYS: string[] = PARKED.map((p) => p.key);

function Pipeline() {
  const { data: leads = [] } = useLeads();
  const { update } = useLeadActions();
  const by = (k: string) => leads.filter((l) => l.status === k);
  const sumPrem = (ls: LeadRow[]) => ls.reduce((a, l) => a + premium(l), 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const due = leads
    .filter(
      (l) =>
        l.follow_at &&
        new Date(l.follow_at) <= endOfToday &&
        !["inforce", "notinterested", "dnc"].includes(l.status),
    )
    .sort((a, b) => +new Date(a.follow_at!) - +new Date(b.follow_at!));

  const columns = [
    ...STAGES.map((s) => ({ ...s, leads: by(s.key) })),
    { key: "parked", label: "Parked", leads: leads.filter((l) => PARKED_KEYS.includes(l.status)) },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      <PageHeader eyebrow="CRM" title="Pipeline" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Leads" value={leads.length} />
        <Tile label="Appointments set" value={by("appointment").length} />
        <Tile
          label="Applications pending"
          value={by("application").length}
          sub={usd(sumPrem(by("application")))}
        />
        <Tile
          label="Policies in force"
          value={by("inforce").length}
          sub={usd(sumPrem(by("inforce")))}
        />
      </div>
      <Panel title={`Follow-ups due today · ${due.length}`}>
        {due.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing due today.</p>
        ) : (
          <ul className="divide-y">
            {due.map((l) => {
              const overdue = new Date(l.follow_at!) < new Date(new Date().setHours(0, 0, 0, 0));
              return (
                <li key={l.id} className="flex items-center gap-3 py-2 text-sm">
                  <span
                    className={cn(
                      "w-28 font-mono text-xs",
                      overdue ? "text-danger" : "text-warning",
                    )}
                  >
                    {overdue ? "Overdue · " : ""}
                    {new Date(l.follow_at!).toLocaleString(
                      [],
                      overdue
                        ? { month: "short", day: "numeric" }
                        : { hour: "numeric", minute: "2-digit" },
                    )}
                  </span>
                  <Link
                    to="/dialer"
                    search={{ lead: l.id }}
                    className="font-semibold hover:underline"
                  >
                    {fullName(l)}
                  </Link>
                  <span className="truncate text-muted-foreground">{l.follow_what}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((c) => (
          <div key={c.key} className="w-64 shrink-0 rounded-xl bg-muted p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{c.label}</h3>
              <span className="font-mono text-xs text-muted-foreground">{c.leads.length}</span>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {c.leads.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No leads
                </div>
              )}
              {c.leads.map((l) => {
                const nx = nextStage(l.status);
                return (
                  <div key={l.id} className="rounded-lg border bg-card p-2.5 shadow-card">
                    <Link to="/dialer" search={{ lead: l.id }} className="block">
                      <div className="flex items-center gap-1.5">
                        <TypeTag type={l.lead_type} />
                        <span className="truncate text-sm font-semibold">{fullName(l)}</span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {formatPhone(l.phone)}
                      </p>
                      {c.key === "parked" && (
                        <p className="text-xs text-muted-foreground">{stageLabel(l.status)}</p>
                      )}
                      {l.follow_at && (
                        <p className="text-xs text-warning">
                          {new Date(l.follow_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                      {premium(l) > 0 && <p className="font-mono text-xs">{usd(premium(l))}</p>}
                    </Link>
                    {nx && (
                      <button
                        onClick={() => update(l.id, stagePatch(l, nx))}
                        className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        {stageLabel(nx)} <ArrowRight className="size-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-primary">{value}</p>
      {sub && <p className="font-mono text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
