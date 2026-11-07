import { licenseFor, readProfile, type QuoteParams } from "@/lib/profile";
import {
  ageFrom,
  money,
  parseDate,
  stateCode,
  US_STATES,
  formatPhone,
  type LeadRow,
} from "@/lib/leads";
import type { Profile } from "@/lib/desk";

export type Ctx = { lead: LeadRow; me: Profile; now: Date };

type D = Record<string, unknown>;
const data = (l: LeadRow) => (l.data ?? {}) as D;
const str = (v: unknown) => (v == null || v === "" ? null : String(v));

const COLUMN: Record<string, keyof LeadRow> = {
  first_name: "first_name",
  firstName: "first_name",
  last_name: "last_name",
  lastName: "last_name",
  phone: "phone",
  email: "email",
  address: "address",
  city: "city",
  state: "state",
  zip: "zip",
};
/** Field aliases used in the spec's verify chips. */
export const fieldKey = (k: string) => (COLUMN[k] as string) ?? k;

export function val(l: LeadRow, key: string): string | null {
  const c = COLUMN[key];
  if (c) return str(l[c]);
  if (key === "age") {
    const d = data(l);
    return str(d["age"]) ?? str(ageFrom(str(d["dob"])));
  }
  return str(data(l)[key]);
}
const num = (l: LeadRow, k: string) => money(val(l, k)) ?? 0;

export const usd = (n: number | null | undefined) =>
  n == null || !isFinite(n) ? null : `$${Math.round(n).toLocaleString("en-US")}`;
const usdOrNull = (v: string | null) => {
  const n = money(v);
  return n == null ? null : usd(n);
};

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]!);
};

export function age(l: LeadRow, now = new Date()): number | null {
  const manual = Number(data(l)["age"]);
  const fromDob = ageFrom(str(data(l)["dob"]), now);
  return fromDob ?? (isFinite(manual) && manual > 0 ? manual : null);
}

export const isMarried = (l: LeadRow) =>
  val(l, "married") === "Married" || val(l, "married") === "Yes";

export function leadHours(l: LeadRow, now = new Date()) {
  return (now.getTime() - new Date(l.lead_date ?? l.created_at).getTime()) / 36e5;
}
export function opener(l: LeadRow, now = new Date()): "A" | "B" {
  const o = val(l, "opener");
  if (o?.startsWith("Opener A")) return "A";
  if (o?.startsWith("Opener B")) return "B";
  return leadHours(l, now) <= 72 ? "A" : "B";
}

const NONE = /^(none|no|n\/a|na|healthy|good|great|nothing|fine|excellent)\.?$/i;
export type Road = "full" | "partialcp" | "cp";
export function road(l: LeadRow, now = new Date()): { road: Road; reason: string } {
  const a = age(l, now);
  if (a != null && a > 65)
    return {
      road: "cp",
      reason: `${val(l, "first_name") ?? "They"} is over 65, so start with Critical Period.`,
    };
  const flags = ["health", "meds", "hospital", "history"].filter((k) => {
    const v = val(l, k);
    return v && !NONE.test(v.trim());
  });
  if (flags.length)
    return {
      road: "partialcp",
      reason: `Health answers on file (${flags.join(", ")}). Lead with Partial payoff or Critical Period.`,
    };
  return {
    road: "full",
    reason: "Under 65 with no health flags. Full or partial payoff; skip Critical Period.",
  };
}

export function cashflow(l: LeadRow) {
  const married = isMarried(l);
  const incA = num(l, "incomeA"),
    incB = married ? num(l, "incomeB") : 0,
    other = num(l, "otherIncome");
  const income = incA + incB + other;
  const bills = num(l, "monthlyPayment") + num(l, "otherBills");
  const lossA = money(val(l, "lossA")) ?? incA;
  const lossB = money(val(l, "lossB")) ?? incB;
  return {
    income,
    bills,
    extra: income - bills,
    withoutA: income - lossA - bills,
    withoutB: income - lossB - bills,
    married,
  };
}

export const HQ = [
  ["hqHeart", "Heart attack, stroke, heart surgery or congestive heart failure"],
  ["hqCancer", "Cancer in the last 2–3 years"],
  ["hqCopd", "COPD, emphysema or oxygen use"],
  ["hqDiab", "Diabetes with insulin, neuropathy or amputation"],
  ["hqKidney", "Kidney failure or dialysis"],
  ["hqHosp", "Hospital stay, nursing home or home health care now"],
  ["hqMemory", "Alzheimer's, dementia or memory issues"],
  ["hqTerminal", "Any terminal diagnosis"],
] as const;

/** Program-based default coverage for MP option rows; 10% anchor premium. */
export function mpPlan(l: LeadRow) {
  const loan = num(l, "loanAmount"),
    pay = num(l, "monthlyPayment");
  const program = val(l, "program") ?? "";
  const months = Math.max(1, Number(val(l, "monthsNeeded")) || 0);
  const anchor = pay ? pay * 0.1 : 0;
  if (program.startsWith("Critical")) {
    const ms = [months + 3, months, Math.max(1, months - 3)];
    return {
      kind: "cp" as const,
      anchor,
      labels: ms.map((m) => `${m} months of payments`),
      covs: ms.map((m) => (pay ? m * pay : 0)),
    };
  }
  const base = program.startsWith("Partial") ? loan / 2 : loan;
  return {
    kind: "pct" as const,
    anchor,
    labels: ["Above 10%", "At 10%", "Below 10%"],
    covs: [base, base, base],
  };
}

export const FE_LABELS = ["Gold", "Silver", "Bronze"];
export const FE_DEFAULT_COVS = [25000, 15000, 10000];

/** Main time zone per state. */
const TZ: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  DC: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  ID: "America/Boise",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/Detroit",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  MT: "America/Denver",
  NE: "America/Chicago",
  NV: "America/Los_Angeles",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NY: "America/New_York",
  NC: "America/New_York",
  ND: "America/Chicago",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VT: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  WV: "America/New_York",
  WI: "America/Chicago",
  WY: "America/Denver",
};
export function localTime(state: string | null, now = new Date()) {
  const code = stateCode(state);
  if (!code) return null;
  const tz = TZ[code]!;
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(
      now,
    ),
  );
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(now);
  return { hour, label, ok: hour >= 8 && hour < 21 };
}

function dayPhrase(iso: string | null, now: Date) {
  const d = parseDate(iso);
  if (!d) return null;
  const date = new Date(d + "T12:00:00");
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const diff = Math.round((+date - +today) / 864e5);
  const pretty = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return diff === 0 ? `today, ${pretty}` : diff === 1 ? `tomorrow, ${pretty}` : pretty;
}

function whenPhrase(l: LeadRow, now: Date) {
  const t = new Date(l.lead_date ?? l.created_at);
  const h = (now.getTime() - t.getTime()) / 36e5;
  const sameDay = t.toDateString() === now.toDateString();
  if (sameDay) return t.getHours() < 12 && now.getHours() >= 12 ? "this morning" : "today";
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (t.toDateString() === y.toDateString()) return "yesterday";
  if (h < 24 * 7) return `on ${t.toLocaleDateString("en-US", { weekday: "long" })}`;
  return "a while back";
}

const profileOf = (me: Profile) => (me.profile ?? {}) as D;
const settingsOf = (me: Profile) => (me.settings ?? {}) as D;

/** Tokens allowed to resolve to an empty string (disappear when they don't apply). */
export const EMPTY_OK = new Set(["andSpouse"]);

export function token(name: string, { lead: l, me, now }: Ctx): string | null {
  const first = val(l, "first_name"),
    spouse = val(l, "spouseName");
  const ben = val(l, "beneficiary");
  switch (name) {
    case "first":
      return first;
    case "last":
      return val(l, "last_name");
    case "full":
      return [first, val(l, "last_name")].filter(Boolean).join(" ") || null;
    case "agent":
      return me.full_name;
    case "agency":
      return str(profileOf(me)["agency"]) ?? "EST8 Financial Group";
    case "agentPhone": {
      const c = str(profileOf(me)["callbackPhone"]) ?? me.phone;
      return c ? formatPhone(c) : null;
    }
    case "npn":
      return me.npn;
    case "licNum": {
      return str(licenseFor(readProfile(me.profile), stateCode(l.state))?.number);
    }
    case "age":
      return str(age(l, now));
    case "nextAge": {
      const a = age(l, now);
      return a == null ? null : String(a + 1);
    }
    case "bday": {
      const d = parseDate(val(l, "dob"));
      return d
        ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })
        : null;
    }
    case "spouse":
      return spouse;
    case "andSpouse":
      return isMarried(l) && spouse ? ` and ${spouse}` : "";
    case "beneficiary":
      return ben;
    case "benFull":
      return val(l, "benFull");
    case "benIsnt":
      return ben ? (/\band\b|&/.test(ben) ? "aren't" : "isn't") : null;
    case "loan":
      return usdOrNull(val(l, "loanAmount"));
    case "halfLoan": {
      const n = money(val(l, "loanAmount"));
      return n ? usd(n / 2) : null;
    }
    case "payment":
      return usdOrNull(val(l, "monthlyPayment"));
    case "homeValue":
      return usdOrNull(val(l, "homeValue"));
    case "equity": {
      const hv = money(val(l, "homeValue")),
        loan = money(val(l, "loanAmount"));
      return hv != null && loan != null ? usd(hv - loan) : null;
    }
    case "concern":
      return val(l, "mainConcern");
    case "goal":
      return val(l, "goal");
    case "occupation":
      return val(l, "occupation");
    case "purchase": {
      const p = val(l, "purchaseType");
      return p ? (p.startsWith("Just") ? "just bought" : "refinanced") : null;
    }
    case "apptDay":
      return dayPhrase(val(l, "apptDay"), now);
    case "apptTime":
      return val(l, "apptTime");
    case "timeA":
      return str(settingsOf(me)["offerTimeA"]) ?? "5:15 pm";
    case "timeB":
      return str(settingsOf(me)["offerTimeB"]) ?? "6:45 pm";
    case "breadwinner":
    case "survivor": {
      const a = num(l, "incomeA"),
        b = num(l, "incomeB");
      if (!isMarried(l) || !spouse) return name === "breadwinner" ? first : ben;
      const aWins = a >= b;
      return name === "breadwinner" ? (aWins ? first : spouse) : aWins ? spouse : first;
    }
    case "incomeA":
      return usdOrNull(val(l, "incomeA"));
    case "months":
      return val(l, "monthsNeeded");
    case "chosen": {
      const c = Number(
        val(l, "chosen")?.replace(/\D/g, "") || FE_LABELS.indexOf(val(l, "chosen") ?? "") + 1,
      );
      if (!c) return null;
      const cov = usdOrNull(val(l, `optCov${c}`)),
        prem = usdOrNull(val(l, `optPrem${c}`));
      const label = l.lead_type === "fe" ? `${FE_LABELS[c - 1]} plan` : `Option ${c}`;
      return [label, cov && `${cov} of coverage`, prem && `${prem} a month`]
        .filter(Boolean)
        .join(", ");
    }
    case "when":
      return whenPhrase(l, now);
    case "platform":
      return val(l, "platform");
    case "oneDetail": {
      if (ben) return `${ben} as the person you'd want taken care of`;
      const b = token("bday", { lead: l, me, now });
      if (b) return `your birthday as ${b}`;
      return l.city ? `that you're in ${l.city}` : null;
    }
    case "cityOrMonth": {
      if (l.city) return l.city;
      const d = parseDate(val(l, "dob"));
      return d
        ? `a ${new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long" })} birthday`
        : null;
    }
    case "state":
      return US_STATES[stateCode(l.state) ?? ""] ?? str(l.state);
    case "city":
      return str(l.city);
    case "hobby":
      return val(l, "hobby");
    case "amountReq":
      return val(l, "amountRequested");
    case "carrier":
      return val(l, "carrier");
    case "amBest":
      return val(l, "amBest");
    case "years":
      return val(l, "carrierYears");
    case "planLine": {
      const p = val(l, "planType");
      if (!p) return null;
      if (p === "Level")
        return "day-one coverage, so the full benefit is there from the very first day";
      return `a plan with a ${val(l, "waitYears") ?? "2"}-year waiting period before the full benefit pays`;
    }
    case "payday": {
      const n = Number(val(l, "payday"));
      return n ? ordinal(n) : val(l, "payday");
    }
    case "draftDay": {
      const n = Number(val(l, "payday"));
      return n ? ordinal(Math.min(n + 1, 28)) : null;
    }
    case "budget":
      return usdOrNull(val(l, "budget"));
    case "feCov1":
    case "feCov2":
    case "feCov3":
      return usdOrNull(val(l, `optCov${name.slice(-1)}`));
    case "fePrem1":
    case "fePrem2":
    case "fePrem3":
      return usdOrNull(val(l, `optPrem${name.slice(-1)}`));
    case "lowerAmt":
      return usdOrNull(val(l, "lowerAmt"));
    case "lowerPrem":
      return usdOrNull(val(l, "lowerPrem"));
    default:
      return val(l, name);
  }
}

const has = (l: LeadRow, k: string) => !!val(l, k);
export const CONDITIONS: Record<string, (c: Ctx) => boolean> = {
  married: ({ lead }) => isMarried(lead),
  stayYes: ({ lead }) => val(lead, "stayNow")?.startsWith("Yes") ?? false,
  stayNo: ({ lead }) => val(lead, "stayNow")?.startsWith("No") ?? false,
  openerA: ({ lead, now }) => opener(lead, now) === "A",
  openerB: ({ lead, now }) => opener(lead, now) === "B",
  agedNever: ({ lead }) => val(lead, "agedBranch")?.startsWith("No") ?? false,
  agedGot: ({ lead }) => val(lead, "agedBranch")?.startsWith("Yes") ?? false,
  agedForgot: ({ lead }) => val(lead, "agedBranch")?.startsWith("I don't") ?? false,
  existingWait: ({ lead }) => /waiting|GI|not sure/i.test(val(lead, "existingPays") ?? ""),
  existingDayOne: ({ lead }) => /day-one/i.test(val(lead, "existingPays") ?? ""),
  forgot: ({ lead }) => val(lead, "remembers") === "Doesn't remember",
  workCoverage: ({ lead }) =>
    [val(lead, "lifeAType"), val(lead, "lifeBType")].includes("Through work"),
  personalCoverage: ({ lead }) => val(lead, "lifeAType") === "Personal",
  progFull: ({ lead }) => val(lead, "program")?.startsWith("Full") ?? false,
  progPartial: ({ lead }) => val(lead, "program")?.startsWith("Partial") ?? false,
  progCP: ({ lead }) => val(lead, "program")?.startsWith("Critical") ?? false,
  over65: ({ lead, now }) => (age(lead, now) ?? 0) > 65,
  roadCP: ({ lead, now }) => road(lead, now).road === "cp",
  roadFull: ({ lead, now }) => road(lead, now).road === "full",
  planGradedGI: ({ lead }) => ["Graded", "Guaranteed issue"].includes(val(lead, "planType") ?? ""),
  hscYes: ({ lead }) => val(lead, "heartStrokeCancer") === "Yes",
  agedWhyGiven: ({ lead, now }) => opener(lead, now) === "B" && has(lead, "why"),
  hasDebtOrRet: ({ lead }) => has(lead, "debtTotal") || has(lead, "retirement"),
};

export function show(cond: string | undefined, ctx: Ctx) {
  if (!cond) return true;
  const neg = cond.startsWith("!");
  const fn = CONDITIONS[neg ? cond.slice(1) : cond];
  const r = fn ? fn(ctx) : true;
  return neg ? !r : r;
}

export function feHealth(l: LeadRow) {
  const n = HQ.filter(([k]) => val(l, k) === "Yes").length;
  return {
    n,
    text: n
      ? `${n} of 8 flagged. Check carrier underwriting; use graded or guaranteed issue only if they won't qualify for level.`
      : "Nothing flagged so far. Look for a level, day-one plan.",
  };
}

/** Coverage and term used for the quote link. */
export function quoteCoverage(l: LeadRow): number | null {
  const c = Number(
    val(l, "chosen")?.replace(/\D/g, "") || FE_LABELS.indexOf(val(l, "chosen") ?? "") + 1,
  );
  if (c && money(val(l, `optCov${c}`))) return money(val(l, `optCov${c}`));
  if (l.lead_type === "fe") return money(val(l, "optCov2")) ?? money(val(l, "amountRequested"));
  const loan = money(val(l, "loanAmount"));
  const p = val(l, "program") ?? "";
  if (p.startsWith("Partial")) return loan ? loan / 2 : null;
  if (p.startsWith("Critical"))
    return (Number(val(l, "monthsNeeded")) || 0) * (money(val(l, "monthlyPayment")) ?? 0) || null;
  return loan;
}
export function quoteTerm(l: LeadRow): number {
  const t = Number(val(l, "qpTerm"));
  if (t) return t;
  return val(l, "loanTerm")?.startsWith("15") ? 20 : 30;
}

export function parseHW(s: string | null) {
  if (!s) return null;
  const m = s.match(/(\d)\s*['’ ]\s*(\d{1,2})?["”]?[\s,]+(\d{2,3})/);
  if (!m) return null;
  return { feet: Number(m[1]), inches: Number(m[2] ?? 0), pounds: Number(m[3]) };
}

/** Rating-only parameters for the Quoteplicity link. Health answers and meds are never included. */
export function quoteParams(
  l: LeadRow,
  now: Date,
  sendContact: boolean,
): { params: QuoteParams; missing: string[] } {
  const hw = parseHW(val(l, "hwA"));
  const nicRaw = (
    val(l, "qpNic") ??
    (val(l, "tobacco") === "Yes" ? "Currently" : val(l, "tobacco") === "No" ? "Never" : "")
  ).toLowerCase();
  const nicotine = nicRaw.startsWith("curr")
    ? "currently"
    : nicRaw.startsWith("rec")
      ? "recently"
      : nicRaw.startsWith("nev")
        ? "never"
        : null;
  const health = (val(l, "qpHealth") ?? "").split(" ")[0] || null;
  const g = (val(l, "gender") ?? "").toLowerCase();
  const params: QuoteParams = {
    state: stateCode(l.state),
    dob: parseDate(val(l, "dob")),
    gender: g.startsWith("m") ? "Male" : g.startsWith("f") ? "Female" : null,
    height_ft: hw?.feet,
    height_in: hw ? hw.inches : null,
    weight: hw?.pounds,
    nicotine,
    health,
    coverage_amount: quoteCoverage(l) ?? null,
    duration: l.lead_type === "fe" ? null : quoteTerm(l),
    results_modal_override: "hide",
    skip_confirmation: 1,
  };
  if (sendContact) {
    const first = val(l, "first_name"),
      last = val(l, "last_name");
    Object.assign(params, {
      first_name: first,
      last_name: last,
      name: [first, last].filter(Boolean).join(" ") || null,
      email: val(l, "email"),
      phone: l.phone_digits ?? null,
    });
  }
  const labels: Record<string, string> = {
    state: "State",
    dob: "Date of birth",
    gender: "Gender",
    height_ft: "Height",
    weight: "Weight",
    nicotine: "Nicotine",
    health: "Health class",
    coverage_amount: "Coverage",
  };
  const missing = Object.entries(labels)
    .filter(([k]) => params[k] == null || params[k] === "")
    .map(([, v]) => v);
  return { params, missing };
}
