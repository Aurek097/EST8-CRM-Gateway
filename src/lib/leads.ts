import type { Tables } from "@/integrations/supabase/types";

export type LeadRow = Tables<"leads">;
export type LogEntry = { at: string; kind: string; text: string };
export type LeadType = "mp" | "fe";

export const US_STATES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

export function stateCode(s?: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  if (t.length === 2 && US_STATES[t.toUpperCase()]) return t.toUpperCase();
  const hit = Object.entries(US_STATES).find(([, n]) => n.toLowerCase() === t.toLowerCase());
  return hit ? hit[0] : null;
}

export const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "").slice(-10);

export function formatPhone(s?: string | null) {
  const d = digits(s);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (s ?? "");
}

/** Parses 6/3/1956, 1956-06-03, 6/3/56 and Excel serial numbers. Returns YYYY-MM-DD. */
export function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" || /^\d{4,5}(\.\d+)?$/.test(String(v).trim())) {
    const n = Number(v);
    if (n > 1000 && n < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
      return d.toISOString().slice(0, 10);
    }
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
    return `${y}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
  }
  return null;
}

export function ageFrom(dob?: string | null, now = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob + "T00:00:00");
  if (isNaN(+d)) return null;
  let a = now.getFullYear() - d.getFullYear();
  const mo = now.getMonth() - d.getMonth();
  if (mo < 0 || (mo === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

export function yesNo(v: unknown): "Yes" | "No" | null {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (["yes", "y", "true", "1"].includes(s)) return "Yes";
  if (["no", "n", "false", "0"].includes(s)) return "No";
  return null;
}

export function money(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}

export const fullName = (l: Pick<LeadRow, "first_name" | "last_name">) =>
  [l.first_name, l.last_name].filter(Boolean).join(" ") || "Unnamed lead";

/** "Option 2" → 2, "Silver" → 2, 3 → 3. */
export function chosenIndex(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/\D/g, ""));
  if (n >= 1 && n <= 3) return n;
  const i = ["Gold", "Silver", "Bronze"].indexOf(String(v));
  return i >= 0 ? i + 1 : null;
}

/** Lead-supplied fields that get verify chips, by type (spouse ones only when married). */
export const VERIFY_FIELDS: Record<LeadType, { key: string; label: string; married?: boolean }[]> =
  {
    mp: [
      { key: "first_name", label: "First name" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "address", label: "Address" },
      { key: "loanAmount", label: "Loan amount" },
      { key: "age", label: "Age" },
      { key: "dob", label: "DOB" },
      { key: "spouseName", label: "Spouse name", married: true },
      { key: "spouseAge", label: "Spouse age", married: true },
      { key: "spouseDob", label: "Spouse DOB", married: true },
    ],
    fe: [
      { key: "first_name", label: "First name" },
      { key: "last_name", label: "Last name" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "dob", label: "DOB" },
      { key: "age", label: "Age" },
      { key: "state", label: "State" },
      { key: "zip", label: "City / ZIP" },
      { key: "amountRequested", label: "Amount requested" },
      { key: "beneficiary", label: "Beneficiary" },
      { key: "benRel", label: "Relationship" },
      { key: "hasLife", label: "Has life insurance" },
      { key: "heartStrokeCancer", label: "Heart/stroke/cancer" },
    ],
  };

const COLUMN_KEYS = new Set([
  "first_name",
  "last_name",
  "phone",
  "email",
  "address",
  "city",
  "state",
  "zip",
]);

export function getField(l: LeadRow, key: string): string {
  if (COLUMN_KEYS.has(key)) return ((l as Record<string, unknown>)[key] as string) ?? "";
  const v = (l.data as Record<string, unknown>)?.[key];
  return v == null ? "" : String(v);
}

export function fieldPatch(l: LeadRow, key: string, value: string): Partial<LeadRow> {
  if (COLUMN_KEYS.has(key)) {
    const p: Record<string, unknown> = { [key]: value || null };
    if (key === "phone") p["phone_digits"] = digits(value) || null;
    return p as Partial<LeadRow>;
  }
  const data = { ...(l.data as Record<string, unknown>), [key]: value || null };
  if (key === "dob") data["age"] = ageFrom(parseDate(value));
  return { data: data as LeadRow["data"] };
}

export function verifyFieldsFor(l: LeadRow) {
  const d = (l.data ?? {}) as Record<string, unknown>;
  const married = d["married"] === "Married" || d["married"] === "Yes";
  return VERIFY_FIELDS[(l.lead_type as LeadType) ?? "mp"].filter((f) => !f.married || married);
}

export function verifiedCount(l: LeadRow) {
  const fields = verifyFieldsFor(l);
  const v = (l.verify ?? {}) as Record<string, string>;
  return { done: fields.filter((f) => v[f.key]).length, total: fields.length };
}

export function premium(l: LeadRow): number {
  const d = (l.data ?? {}) as Record<string, unknown>;
  const p = money(d["polPrem"]);
  if (p) return p;
  const c = chosenIndex(d["chosen"]);
  const ch = c ? money(d[`optPrem${c}`]) : null;
  return ch ?? 0;
}

export function logEntry(kind: string, text: string, at = new Date()): LogEntry {
  return { at: at.toISOString(), kind, text };
}

/** Dial outcome rules from the spec. */
export function applyOutcome(
  l: LeadRow,
  outcome: "noanswer" | "voicemail" | "text" | "talked",
  now = new Date(),
) {
  const labels = {
    noanswer: "No answer",
    voicemail: "Left voicemail",
    text: "Sent text",
    talked: "Talked",
  } as const;
  const kinds = {
    noanswer: "No answer",
    voicemail: "Voicemail",
    text: "Text",
    talked: "Talked",
  } as const;
  const log = [...((l.log ?? []) as LogEntry[])];
  log.push(logEntry(kinds[outcome], labels[outcome], now));
  const patch: Partial<LeadRow> = {
    last_dial: now.toISOString(),
    dials: l.dials + (outcome === "text" ? 0 : 1),
  };
  let status = l.status;
  const stageAt = { ...((l.stage_at ?? {}) as Record<string, string>) };
  if (outcome === "talked" && l.status === "new") {
    status = "contacted";
    stageAt["contacted"] = now.toISOString();
    log.push(logEntry("Stage", "New lead → Contacted", now));
  }
  return { ...patch, status, stage_at: stageAt, log } as Partial<LeadRow>;
}
