import { useMemo, useState } from "react";
import { Upload, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatPhone, fullName, getField, verifiedCount, type LeadRow } from "@/lib/leads";
import { ALL_STAGES, stageLabel, stageTone } from "@/lib/stages";
import { TypeTag } from "@/components/lead-bits";

export function LeadQueue({
  leads,
  selectedId,
  onSelect,
  onImport,
  onAdd,
  onRemoveSamples,
}: {
  leads: LeadRow[];
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
  onImport: () => void;
  onAdd: () => void;
  onRemoveSamples: () => void;
}) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [type, setType] = useState("all");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const sd = s.replace(/\D/g, "");
    return leads.filter((l) => {
      if (stage !== "all" && l.status !== stage) return false;
      if (type !== "all" && l.lead_type !== type) return false;
      if (!s) return true;
      const hay = [fullName(l), l.city, l.address, l.email, getField(l, "spouseName")]
        .join(" ")
        .toLowerCase();
      return hay.includes(s) || (sd.length >= 3 && (l.phone_digits ?? "").includes(sd));
    });
  }, [leads, q, stage, type]);

  const hasSamples = leads.some((l) => l.sample);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onImport}>
          <Upload /> Import
        </Button>
        <Button size="sm" className="flex-1" onClick={onAdd}>
          <Plus /> Lead
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Search name, phone, city, email"
          className="pl-8"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <select
          className="h-8 flex-1 rounded-md border bg-card px-2 text-xs"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="all">All stages</option>
          {ALL_STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="h-8 flex-1 rounded-md border bg-card px-2 text-xs"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">All types</option>
          <option value="mp">Mortgage</option>
          <option value="fe">Final expense</option>
        </select>
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        {filtered.length} of {leads.length} leads
      </p>
      <ul className="space-y-1.5 lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto lg:pr-1">
        {filtered.map((l) => {
          const v = verifiedCount(l);
          const amt =
            l.lead_type === "fe"
              ? getField(l, "amountRequested")
              : getField(l, "loanAmount")
                ? `$${Number(getField(l, "loanAmount")).toLocaleString()}`
                : "";
          return (
            <li key={l.id}>
              <button
                onClick={() => onSelect(l.id)}
                className={cn(
                  "w-full rounded-lg border bg-card p-2.5 text-left transition hover:border-sky",
                  selectedId === l.id && "border-sky ring-2 ring-sky/30",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <TypeTag type={l.lead_type} />
                  <span className="truncate text-sm font-semibold">{fullName(l)}</span>
                  {l.sample && (
                    <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                      Sample
                    </span>
                  )}
                  <span
                    className={cn(
                      "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      stageTone(l.status),
                    )}
                  >
                    {stageLabel(l.status)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span className="truncate">
                    {[l.city, amt].filter(Boolean).join(" · ") || formatPhone(l.phone)}
                  </span>
                  <span className="font-mono">
                    {v.done}/{v.total}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {hasSamples && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={onRemoveSamples}
        >
          <Trash2 /> Remove sample leads
        </Button>
      )}
    </div>
  );
}
