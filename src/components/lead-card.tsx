import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Pencil, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  verifyFieldsFor,
  fieldPatch,
  formatPhone,
  fullName,
  getField,
  stateCode,
  US_STATES,
  type LeadRow,
  type LeadType,
  type LogEntry,
} from "@/lib/leads";
import { STAGES, PARKED, stageTone } from "@/lib/stages";
import { notePatch, stagePatch } from "@/lib/lead-mutations";
import { licenseFor, readProfile } from "@/lib/profile";
import { useDesk } from "@/lib/desk";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="eyebrow">{title}</h3>
      {children}
    </section>
  );
}

export function LicenseBadge({ state }: { state: string | null }) {
  const { me } = useDesk();
  const code = stateCode(state);
  if (!code)
    return (
      <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning">
        State missing
      </span>
    );
  const ok = (me.licensed_states ?? []).includes(code);
  const num = licenseFor(readProfile(me.profile), code)?.number;
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[11px] font-semibold",
        ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
      )}
    >
      {ok ? `Licensed here · ${code}${num ? ` #${num}` : ""}` : `Not licensed in ${code}`}
    </span>
  );
}

export function LeadCard({
  lead,
  onChange,
  onDelete,
  extra,
}: {
  lead: LeadRow;
  onChange: (p: Partial<LeadRow>) => void;
  onDelete: () => void;
  extra?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const d = (lead.data ?? {}) as { trustedForm?: unknown; extra?: Record<string, string> } & Record<
    string,
    unknown
  >;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-card">
      <div>
        <h2 className="text-xl font-bold text-primary">{fullName(lead)}</h2>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-mono text-sm">{formatPhone(lead.phone) || "No phone"}</span>
          {lead.phone && (
            <button
              className="text-muted-foreground hover:text-primary"
              aria-label="Copy phone"
              onClick={() => {
                navigator.clipboard.writeText(formatPhone(lead.phone));
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
            </button>
          )}
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {lead.dials} dials
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <LicenseBadge state={lead.state} />
          {lead.status === "dnc" && (
            <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-semibold text-danger">
              Do not call
            </span>
          )}
        </div>
      </div>

      <div className="flex rounded-lg bg-muted p-0.5 text-xs font-semibold">
        {(["mp", "fe"] as LeadType[]).map((t) => (
          <button
            key={t}
            onClick={() => onChange({ lead_type: t })}
            className={cn(
              "flex-1 rounded-md py-1.5",
              lead.lead_type === t ? "bg-card text-primary shadow-card" : "text-muted-foreground",
            )}
          >
            {t === "mp" ? "Mortgage protection" : "Final expense"}
          </button>
        ))}
      </div>

      <Section title="Stage">
        <ol className="grid grid-cols-6 gap-1">
          {STAGES.map((s, i) => {
            const cur = STAGES.findIndex((x) => x.key === lead.status);
            return (
              <li key={s.key}>
                <button
                  title={s.label}
                  onClick={() => onChange(stagePatch(lead, s.key))}
                  className={cn("h-1.5 w-full rounded-full", cur >= i ? "bg-primary" : "bg-muted")}
                />
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-1">
          {[...STAGES, ...PARKED].map((s) => (
            <button
              key={s.key}
              onClick={() => onChange(stagePatch(lead, s.key))}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px]",
                lead.status === s.key
                  ? cn(stageTone(s.key), "border-transparent font-semibold")
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Section>

      <FollowUp lead={lead} onChange={onChange} />
      <Activity lead={lead} onChange={onChange} />
      <Verification lead={lead} onChange={onChange} />
      {extra}

      <Section title="Policy">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["carrier", "Carrier"],
              ["polCov", "Coverage"],
              ["polPrem", "Monthly premium"],
              ["appDate", "App date"],
              ["draftDate", "Draft date"],
              ["policyNo", "Policy #"],
              ["effDate", "Effective"],
            ] as const
          ).map(([k, l]) => (
            <FieldInput
              key={k}
              label={l}
              value={getField(lead, k)}
              onSave={(v) => onChange(fieldPatch(lead, k, v))}
              mono={k !== "carrier"}
            />
          ))}
        </div>
      </Section>

      <Section title="All lead fields">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["address", "Address"],
              ["zip", "ZIP"],
              ["age", "Age"],
              ["gender", "Gender"],
              ...(lead.lead_type === "mp"
                ? [
                    ["loanAmount", "Loan"],
                    ["lender", "Lender"],
                    ["spouseName", "Spouse"],
                    ["spouseDob", "Spouse DOB"],
                  ]
                : [
                    ["amountRequested", "Amount"],
                    ["hasLife", "Has life ins."],
                    ["hobby", "Hobby"],
                    ["platform", "Platform"],
                    ["interestedIn", "Interested in"],
                    ["ad", "Ad"],
                  ]),
              ["leadSource", "Source"],
            ] as [string, string][]
          ).map(([k, l]) => (
            <FieldInput
              key={k}
              label={l}
              value={getField(lead, k)}
              onSave={(v) => onChange(fieldPatch(lead, k, v))}
            />
          ))}
        </div>
        {typeof d.trustedForm === "string" && d.trustedForm && (
          <a
            href={d.trustedForm}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary underline"
          >
            TrustedForm certificate <ExternalLink className="size-3" />
          </a>
        )}
        {d.extra && typeof d.extra === "object" && Object.keys(d.extra).length > 0 ? (
          <div className="rounded-lg bg-muted p-2">
            <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
              Other columns from your sheet
            </p>
            {Object.entries(d.extra as Record<string, string>).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{k}</span>
                <span className="truncate font-mono">{v}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Section>

      <div className="border-t pt-4">
        {confirmDel ? (
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Tap again to delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            onClick={() => setConfirmDel(true)}
          >
            <Trash2 /> Delete lead
          </Button>
        )}
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onSave,
  mono,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  mono?: boolean;
}) {
  const [v, setV] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setV(value);
  }
  return (
    <label className="space-y-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onSave(v)}
        className={cn("h-8 text-sm", mono && "font-mono")}
      />
    </label>
  );
}

function FollowUp({ lead, onChange }: { lead: LeadRow; onChange: (p: Partial<LeadRow>) => void }) {
  const local = lead.follow_at ? toLocalInput(new Date(lead.follow_at)) : "";
  const overdue = lead.follow_at && new Date(lead.follow_at) < new Date();
  return (
    <Section title="Next follow-up">
      <div className="flex gap-2">
        <Input
          type="datetime-local"
          value={local}
          className={cn("h-8 text-sm", overdue && "text-warning")}
          onChange={(e) =>
            onChange({ follow_at: e.target.value ? new Date(e.target.value).toISOString() : null })
          }
        />
        {lead.follow_at && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange({ follow_at: null, follow_what: null })}
          >
            Clear
          </Button>
        )}
      </div>
      <FieldInput
        label="What for"
        value={lead.follow_what ?? ""}
        onSave={(v) => onChange({ follow_what: v || null })}
      />
    </Section>
  );
}

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Activity({ lead, onChange }: { lead: LeadRow; onChange: (p: Partial<LeadRow>) => void }) {
  const [kind, setKind] = useState("Note");
  const [text, setText] = useState("");
  const log = [...((lead.log ?? []) as LogEntry[])].reverse().slice(0, 40);
  return (
    <Section title="Notes and activity">
      <Textarea
        rows={2}
        placeholder="Add a note from the call"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2">
        <select
          className="h-8 rounded-md border bg-card px-2 text-xs"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {["Note", "Call", "Voicemail", "Text"].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!text.trim()}
          onClick={() => {
            onChange(notePatch(lead, kind, text.trim()));
            setText("");
            toast.success("Added to activity");
          }}
        >
          Add to activity
        </Button>
      </div>
      <ul className="max-h-64 space-y-1.5 overflow-y-auto">
        {log.map((e, i) => (
          <li key={i} className="text-xs">
            <span className="font-mono text-muted-foreground">
              {new Date(e.at).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span className="mx-1.5 rounded bg-muted px-1 font-semibold">{e.kind}</span>
            <span>{e.text}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Verification({
  lead,
  onChange,
}: {
  lead: LeadRow;
  onChange: (p: Partial<LeadRow>) => void;
}) {
  const fields = verifyFieldsFor(lead);
  const v = (lead.verify ?? {}) as Record<string, string>;
  const orig = (lead.orig ?? {}) as Record<string, string>;
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const done = fields.filter((f) => v[f.key]).length;

  const fix = (key: string) => {
    const before = getField(lead, key);
    const newOrig = key in orig ? orig : { ...orig, [key]: before };
    onChange({ ...fieldPatch(lead, key, draft), verify: { ...v, [key]: "fixed" }, orig: newOrig });
    setEditing(null);
  };

  return (
    <Section title={`Verification · ${done}/${fields.length}`}>
      <ul className="space-y-1">
        {fields.map((f) => {
          let val = getField(lead, f.key);
          if (f.key === "state" && val) val = US_STATES[stateCode(val) ?? ""] ?? val;
          const st = v[f.key];
          return (
            <li key={f.key} className="text-sm">
              {editing === f.key ? (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && fix(f.key)}
                  />
                  <Button size="sm" onClick={() => fix(f.key)}>
                    Save
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">{f.label}</span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate rounded px-1.5 py-0.5",
                      st ? "bg-sky-soft text-primary" : val ? "" : "italic text-warning",
                    )}
                  >
                    {val || `[${f.label.toLowerCase()}]`}
                  </span>
                  <button
                    aria-label={`Verify ${f.label}`}
                    onClick={() => {
                      const n = { ...v };
                      if (st) delete n[f.key];
                      else n[f.key] = "ok";
                      onChange({ verify: n });
                    }}
                    className={cn(
                      "rounded-full p-1",
                      st
                        ? "bg-success text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    aria-label={`Fix ${f.label}`}
                    onClick={() => {
                      setEditing(f.key);
                      setDraft(val);
                    }}
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </div>
              )}
              {st === "fixed" && orig[f.key] != null && orig[f.key] !== getField(lead, f.key) && (
                <p className="ml-26 text-[11px] text-muted-foreground">
                  Lead had: {orig[f.key] || "(blank)"}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
