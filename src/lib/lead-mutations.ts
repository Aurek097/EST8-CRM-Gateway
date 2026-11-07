import { chosenIndex, fieldPatch, logEntry, type LeadRow, type LogEntry } from "./leads";
import { stageLabel } from "./stages";

/** Stage change: logs "Old → New", records the date reached. Application fills app date and policy from chosen option. */
export function stagePatch(l: LeadRow, to: string, now = new Date()): Partial<LeadRow> {
  if (to === l.status) return {};
  const log = [
    ...((l.log ?? []) as LogEntry[]),
    logEntry("Stage", `${stageLabel(l.status)} → ${stageLabel(to)}`, now),
  ];
  const stage_at = { ...((l.stage_at ?? {}) as Record<string, string>), [to]: now.toISOString() };
  const patch: Partial<LeadRow> = { status: to, log, stage_at };
  if (to === "application") {
    const d = { ...((l.data ?? {}) as Record<string, unknown>) };
    if (!d["appDate"]) d["appDate"] = now.toISOString().slice(0, 10);
    const c = chosenIndex(d["chosen"]);
    if (c) {
      if (!d["polCov"]) d["polCov"] = d[`optCov${c}`] ?? null;
      if (!d["polPrem"]) d["polPrem"] = d[`optPrem${c}`] ?? null;
    }
    patch.data = d as LeadRow["data"];
  }
  return patch;
}

export function notePatch(
  l: LeadRow,
  kind: string,
  text: string,
  now = new Date(),
): Partial<LeadRow> {
  return { log: [...((l.log ?? []) as LogEntry[]), logEntry(kind, text, now)] };
}

/** Verify chip: toggle ok. */
export function verifyToggle(l: LeadRow, key: string): Partial<LeadRow> {
  const v = { ...((l.verify ?? {}) as Record<string, string>) };
  if (v[key]) delete v[key];
  else v[key] = "ok";
  return { verify: v };
}

/** Verify chip: correct a value, keeping what the lead originally said. */
export function verifyFix(
  l: LeadRow,
  key: string,
  value: string,
  before: string,
): Partial<LeadRow> {
  const v = { ...((l.verify ?? {}) as Record<string, string>), [key]: "fixed" };
  const orig = { ...((l.orig ?? {}) as Record<string, string>) };
  if (!(key in orig)) orig[key] = before;
  return { ...fieldPatch(l, key, value), verify: v, orig };
}
