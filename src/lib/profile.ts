/** Agent profile data (stored in profiles.profile jsonb) and the rules that read it. Pure functions. */

export type License = { state: string; number: string; expires: string; resident: boolean };
export type WritingStatus = "Appointed" | "Pending" | "Inactive";
export type WritingNumber = { carrier: string; number: string; status: WritingStatus };
export type AgentProfileData = {
  role?: string;
  bookingLink?: string;
  imo?: string;
  agency?: string;
  callbackPhone?: string;
  photoX?: number;
  photoY?: number;
  quoteMp?: string;
  quoteFe?: string;
  quoteSendContact?: boolean;
  licenses?: License[];
  writingNumbers?: WritingNumber[];
  amlProvider?: string;
  amlDate?: string;
  eoCarrier?: string;
  eoPolicy?: string;
  eoCert?: string;
  eoExpires?: string;
};

export const AGENT_ROLES = ["Agent", "Agency owner", "Manager", "Recruiter", "Trainee"];
export const DEFAULT_AGENCY = "EST8 Financial Group";

export const STANDARD_CARRIERS = [
  "American Amicable",
  "Americo",
  "Corebridge/AIG",
  "F&G",
  "Foresters",
  "LGA",
  "Mutual of Omaha",
  "SBLI",
  "Transamerica",
  "UHL",
  "Aetna/CVS",
  "Royal Neighbors",
  "Gerber",
  "Liberty Bankers",
  "Prosperity",
];

/** Older saves kept licenses as a { TX: { number } } map; accept both. */
export function readProfile(raw: unknown): AgentProfileData {
  const p = { ...((raw ?? {}) as Record<string, unknown>) } as AgentProfileData &
    Record<string, unknown>;
  if (p.licenses && !Array.isArray(p.licenses)) {
    p.licenses = Object.entries(p.licenses as Record<string, { number?: string }>).map(
      ([state, v]) => ({ state, number: v?.number ?? "", expires: "", resident: false }),
    );
  }
  if (p.writingNumbers && !Array.isArray(p.writingNumbers)) {
    p.writingNumbers = Object.entries(p.writingNumbers as Record<string, string>).map(
      ([carrier, number]) => ({ carrier, number, status: "Appointed" as const }),
    );
  }
  return p;
}

export const licensedStatesOf = (p: AgentProfileData) => [
  ...new Set(
    (p.licenses ?? []).map((l) => l.state.trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s)),
  ),
];

export function licenseFor(p: AgentProfileData, state: string | null) {
  if (!state) return null;
  return (p.licenses ?? []).find((l) => l.state.toUpperCase() === state.toUpperCase()) ?? null;
}

const ALIASES: Record<string, string> = {
  "corebridge/aig": "american general",
  corebridge: "american general",
  aig: "american general",
  "f&g": "fidelity and guaranty",
  uhl: "united home life",
  lga: "legal & general america",
  banner: "banner life",
};
/** Normalized carrier name: drops "(…)", lowercases, applies aliases. */
export function carrierKey(name: string) {
  const n = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return ALIASES[n] ?? n;
}
export function carriersMatch(a: string, b: string) {
  const x = carrierKey(a),
    y = carrierKey(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
}
export function writingNumbersFor(p: AgentProfileData, carrier: string | null) {
  if (!carrier) return [];
  return (p.writingNumbers ?? []).filter(
    (w) => w.number && w.status !== "Inactive" && carriersMatch(w.carrier, carrier),
  );
}

export function carrierSuggestions(p: AgentProfileData) {
  const mine = (p.writingNumbers ?? [])
    .filter((w) => w.status !== "Inactive")
    .map((w) => w.carrier.replace(/\(.*?\)/g, "").trim());
  const out: string[] = [];
  for (const c of [...mine, ...STANDARD_CARRIERS])
    if (c && !out.some((o) => o.toLowerCase() === c.toLowerCase())) out.push(c);
  return out;
}

export type Alert = { tone: "warn" | "bad"; text: string };
const daysUntil = (iso: string, now: Date) =>
  Math.floor((new Date(iso + "T23:59:59").getTime() - now.getTime()) / 86400000);

export function profileAlerts(p: AgentProfileData, now = new Date()): Alert[] {
  const out: Alert[] = [];
  if (licensedStatesOf(p).length === 0)
    out.push({
      tone: "warn",
      text: "No licensed states saved. Lead calls and quotes stay blocked until you add them.",
    });
  const check = (iso: string | undefined, label: string) => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const d = daysUntil(iso, now);
    if (d < 0) out.push({ tone: "bad", text: `${label} expired on ${iso}.` });
    else if (d <= 60)
      out.push({
        tone: "warn",
        text: `${label} expires in ${d} day${d === 1 ? "" : "s"} (${iso}).`,
      });
  };
  for (const l of p.licenses ?? []) check(l.expires, `${l.state.toUpperCase()} license`);
  check(p.eoExpires, "E&O policy");
  return out;
}

export type QuoteParams = Record<string, string | number | null | undefined>;
/** Replaces params already in the base link, keeps others, drops empty values. */
export function buildQuoteUrl(base: string, params: QuoteParams): string | null {
  let url: URL;
  try {
    url = new URL(base.trim());
  } catch {
    return null;
  }
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  }
  return url.toString();
}
