/** Server-enforced calling/texting rules from the spec, as pure functions (shared by server and tests). */
import { digits, stateCode, US_STATES } from "@/lib/leads";
import { localTime } from "@/scripts/engine";

type RuleLead = {
  phone: string | null;
  status: string;
  state: string | null;
  sms_opt_out?: boolean;
};

/** +1XXXXXXXXXX for a valid U.S. (NANP) number, else null. */
export function toE164(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d.length === 10 ? d : null;
  if (!ten || !/^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return null;
  return `+1${ten}`;
}

/** First failing rule, in the spec's order, or null when the call may go out. */
export function callRuleFailure(
  l: RuleLead,
  licensedStates: string[],
  now = new Date(),
): string | null {
  if (!toE164(l.phone)) return "This lead's number isn't a valid U.S. number.";
  if (l.status === "dnc") return "This lead is marked Do not call.";
  const code = stateCode(l.state);
  if (!code) return "This lead has no state, so calling hours and licensing can't be checked.";
  if (!licensedStates.length) return "You have no licensed states in your Profile.";
  if (!licensedStates.includes(code))
    return `This lead is in ${code}, which is not one of your licensed states.`;
  const t = localTime(code, now);
  if (!t?.ok)
    return `It's ${t?.label ?? "outside calling hours"} in ${US_STATES[code]}. Calls are allowed 8 a.m. to 9 p.m. their time.`;
  return null;
}

export function textRuleFailure(l: RuleLead, body: string, from: string | null): string | null {
  if (l.status === "dnc") return "This lead is marked Do not call.";
  if (l.sms_opt_out) return "This lead replied STOP.";
  if (!toE164(l.phone)) return "This lead's number isn't a valid U.S. number.";
  if (!body.trim()) return "Write a message first.";
  if (body.length > 1500) return "Texts can be at most 1,500 characters.";
  if (!from) return "You have no number to text from. Buy one on the Numbers page.";
  return null;
}

export const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
export const START_WORDS = ["START", "UNSTOP"];
/** "stop" | "start" | null, from Telnyx's autoresponse_type or the reply text. */
export function optChange(
  text: string | null | undefined,
  autoresponse?: string | null,
): "stop" | "start" | null {
  const a = (autoresponse ?? "").toLowerCase();
  if (a.includes("opt_out") || a === "stop") return "stop";
  if (a.includes("opt_in") || a === "start") return "start";
  const t = (text ?? "").trim().toUpperCase();
  if (STOP_WORDS.includes(t)) return "stop";
  if (START_WORDS.includes(t)) return "start";
  return null;
}

type Num = { phone_number: string; region: string | null; is_primary: boolean };
/** Agent's number in the lead's state → primary caller ID → primary number → any number → default. */
export function pickCallerId(
  nums: Num[],
  leadState: string | null,
  primaryCallerId: string | null,
  fallback: string | null,
): string | null {
  const code = stateCode(leadState);
  const inState = code ? nums.find((n) => (n.region ?? "").toUpperCase() === code) : undefined;
  return (
    inState?.phone_number ??
    toE164(primaryCallerId) ??
    nums.find((n) => n.is_primary)?.phone_number ??
    nums[0]?.phone_number ??
    toE164(fallback)
  );
}

export function hangupOutcome(cause: string | null | undefined, answered: boolean): string {
  if (answered) return "answered";
  const c = (cause ?? "").toLowerCase();
  if (c.includes("busy")) return "busy";
  if (c.includes("timeout") || c.includes("no_answer")) return "no answer";
  if (c.includes("cancel")) return "canceled";
  if (c.includes("normal")) return "no answer";
  return "failed";
}

/** Telnyx client_state is base64 JSON. */
export const encodeState = (o: Record<string, unknown>) => btoa(JSON.stringify(o));
export type CallState = Partial<
  Record<"k" | "l" | "leadId" | "a" | "u" | "r" | "i" | "f" | "n" | "rec" | "ans", string>
>;
export function decodeState(s: string | null | undefined): CallState {
  if (!s) return {};
  try {
    const o = JSON.parse(atob(s)) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) as CallState;
  } catch {
    return {};
  }
}

export const phoneKey = (p: string | null | undefined) => digits(p);
