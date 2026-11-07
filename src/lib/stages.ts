export type StageKey =
  "new" | "contacted" | "appointment" | "application" | "inforce" | "notinterested" | "dnc";

export const STAGES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "appointment", label: "Appointment" },
  { key: "application", label: "Application" },
  { key: "inforce", label: "In Force" },
] as const;

export const PARKED = [
  { key: "notinterested", label: "Not Interested" },
  { key: "dnc", label: "Do Not Call" },
] as const;

export const ALL_STAGES = [...STAGES, ...PARKED];

export function stageLabel(key?: string | null): string {
  if (!key) return "New";
  const found = ALL_STAGES.find((s) => s.key === key);
  return found?.label ?? key;
}

export function nextStage(current?: string | null): string | null {
  const idx = STAGES.findIndex((s) => s.key === current);
  if (idx >= 0 && idx < STAGES.length - 1) {
    return STAGES[idx + 1]?.key ?? null;
  }
  return null;
}

export function stageTone(key?: string | null): string {
  switch (key) {
    case "new":
      return "bg-blue-500/10 text-blue-500";
    case "contacted":
      return "bg-amber-500/10 text-amber-500";
    case "appointment":
      return "bg-purple-500/10 text-purple-500";
    case "application":
      return "bg-emerald-500/10 text-emerald-500";
    case "inforce":
      return "bg-emerald-600/20 text-emerald-600";
    case "dnc":
      return "bg-destructive/10 text-destructive";
    case "notinterested":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}
