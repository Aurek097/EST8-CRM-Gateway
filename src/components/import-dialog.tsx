import { useMemo, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  TARGET_FIELDS,
  TARGET_LABELS,
  dupKey,
  guessTarget,
  isSkippable,
  mapRow,
  parsePasted,
  type Grid,
  type Target,
} from "@/lib/import";
import { logEntry, type LeadType } from "@/lib/leads";
import { useLeadActions, useLeads } from "@/lib/use-leads";

async function readFile(file: File): Promise<Grid> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]!]!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
    return rows.map((r) => r.map((c) => (c == null ? "" : String(c))));
  }
  const text = await file.text();
  const res = Papa.parse<string[]>(text, {
    skipEmptyLines: true,
    delimiter: name.endsWith(".tsv") ? "\t" : "",
  });
  return res.data;
}

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [paste, setPaste] = useState("");
  const [typeChoice, setTypeChoice] = useState<"detect" | LeadType>("detect");
  const [busy, setBusy] = useState(false);
  const { data: existing = [] } = useLeads();
  const { insertMany } = useLeadActions();

  const load = (g: Grid) => {
    const clean = g.filter((r) => r.some((c) => String(c).trim()));
    if (clean.length < 2) {
      toast.error("Need a header row and at least one lead");
      return;
    }
    setGrid(clean);
    setTargets(clean[0]!.map((h) => guessTarget(h)));
  };

  const reset = () => {
    setGrid(null);
    setTargets([]);
    setPaste("");
  };

  const headers = grid?.[0] ?? [];
  const sample = (i: number) => grid?.slice(1).find((r) => r[i])?.[i] ?? "";

  const preview = useMemo(() => {
    if (!grid) return { mp: 0, fe: 0 };
    let mp = 0,
      fe = 0;
    for (const r of grid.slice(1)) {
      if (mapRow(headers, r, targets, typeChoice).lead_type === "fe") {
        fe++;
      } else {
        mp++;
      }
    }
    return { mp, fe };
  }, [grid, targets, typeChoice, headers]);

  const run = async () => {
    if (!grid) return;
    setBusy(true);
    const phones = new Set(existing.map((l) => l.phone_digits).filter(Boolean));
    const nameAddr = new Set(existing.map((l) => dupKey.nameAddr(l)).filter(Boolean));
    let skipped = 0,
      dups = 0;
    const now = new Date();
    const rows = [];
    for (const r of grid.slice(1)) {
      const l = mapRow(headers, r, targets, typeChoice);
      if (isSkippable(l)) {
        skipped++;
        continue;
      }
      const p = dupKey.phone(l),
        na = dupKey.nameAddr(l);
      if ((p && phones.has(p)) || (na && nameAddr.has(na))) {
        dups++;
        continue;
      }
      if (p) phones.add(p);
      if (na) nameAddr.add(na);
      rows.push({
        ...l,
        data: l.data as never,
        status: "new",
        stage_at: { new: now.toISOString() },
        log: [
          logEntry(
            "Note",
            `Imported as ${l.lead_type === "fe" ? "final expense" : "mortgage protection"} lead`,
            now,
          ),
        ] as never,
      });
    }
    try {
      await insertMany(rows);
      toast.success(
        `Added ${rows.length} leads${dups ? ` · ${dups} duplicates skipped` : ""}${skipped ? ` · ${skipped} empty rows skipped` : ""}`,
      );
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Import failed. Nothing was added.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import leads</DialogTitle>
          <DialogDescription>
            CSV, TSV, Excel, or rows pasted from Google Sheets. The first row is the header.
          </DialogDescription>
        </DialogHeader>

        {!grid ? (
          <div className="space-y-4">
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) load(await readFile(f));
              }}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center hover:bg-muted"
            >
              <Upload className="size-6 text-primary" />
              <span className="font-semibold">Drop a file or click to choose</span>
              <span className="text-xs text-muted-foreground">.csv · .tsv · .xlsx · .xls</span>
              <input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) load(await readFile(f));
                }}
              />
            </label>
            <div className="space-y-2">
              <p className="eyebrow">Or paste rows</p>
              <Textarea
                rows={5}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder="First Name	Last Name	Phone…"
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!paste.trim()}
                onClick={() => load(parsePasted(paste))}
              >
                Use pasted rows
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Lead type</span>
              {(
                [
                  ["detect", "Detect"],
                  ["fe", "Final expense"],
                  ["mp", "Mortgage protection"],
                ] as const
              ).map(([k, l]) => (
                <Button
                  key={k}
                  size="sm"
                  variant={typeChoice === k ? "default" : "outline"}
                  onClick={() => setTypeChoice(k)}
                >
                  {l}
                </Button>
              ))}
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {grid.length - 1} rows · {preview.fe} FE · {preview.mp} MP
              </span>
            </div>
            <div className="divide-y rounded-lg border">
              {headers.map((h, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_1.2fr] items-center gap-3 px-3 py-2 text-sm"
                >
                  <span className="truncate font-semibold">
                    {h || <em className="text-muted-foreground">(blank)</em>}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {sample(i)}
                  </span>
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                    value={targets[i]}
                    onChange={(e) =>
                      setTargets((t) => t.map((x, j) => (j === i ? (e.target.value as Target) : x)))
                    }
                  >
                    {[...TARGET_FIELDS, "extra", "ignore"].map((t) => (
                      <option key={t} value={t}>
                        {TARGET_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {grid && (
          <DialogFooter>
            <Button variant="ghost" onClick={reset}>
              Start over
            </Button>
            <Button variant="ember" onClick={run} disabled={busy}>
              {busy ? "Adding…" : `Add ${grid.length - 1} leads`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
