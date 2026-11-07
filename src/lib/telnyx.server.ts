/** Server-only Telnyx helpers. Secrets are read per call, never at module scope. */
import { logEntry, type LeadRow } from "@/lib/leads";

const API = "https://api.telnyx.com/v2";

export function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

export class TelnyxError extends Error {
  constructor(
    public status: number,
    public body: string,
    public code: string | null,
  ) {
    super(`Telnyx ${status}: ${body}`);
  }
}

export async function tx<T = any>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string>; raw?: boolean } = {},
): Promise<T> {
  const key = env("TELNYX_API_KEY");
  if (!key) throw new TelnyxError(0, "TELNYX_API_KEY is not set", null);
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : null,
  });
  const text = await res.text();
  if (!res.ok) {
    let code: string | null = null;
    try {
      code = JSON.parse(text)?.errors?.[0]?.code ?? null;
    } catch {
      /* ignore */
    }
    console.error(`Telnyx ${init.method ?? "GET"} ${path} failed [${res.status}]: ${text}`);
    throw new TelnyxError(res.status, text, code);
  }
  if (init.raw) return text as T;
  return (text ? JSON.parse(text) : {}) as T;
}

/** Friendly message for a Telnyx failure. */
export function telnyxMessage(e: unknown): string {
  if (e instanceof TelnyxError) {
    if (e.code === "40300") return "This lead replied STOP.";
    if (e.status === 0) return "Phone service isn't set up yet.";
    try {
      const d = JSON.parse(e.body)?.errors?.[0];
      if (d?.detail || d?.title) return `Telnyx: ${d.detail ?? d.title}`;
    } catch {
      /* ignore */
    }
    return `Telnyx returned an error (${e.status}).`;
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Ed25519 check of telnyx-signature-ed25519 over `${timestamp}|${rawBody}`; rejects stale (>5 min) requests. */
export async function verifyTelnyx(req: Request, raw: string): Promise<boolean> {
  const pub = env("TELNYX_PUBLIC_KEY");
  const sig = req.headers.get("telnyx-signature-ed25519");
  const ts = req.headers.get("telnyx-timestamp");
  if (!pub || !sig || !ts) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  try {
    const key = await crypto.subtle.importKey("raw", b64(pub), { name: "Ed25519" }, false, [
      "verify",
    ]);
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      b64(sig),
      new TextEncoder().encode(`${ts}|${raw}`),
    );
  } catch (e) {
    console.error("Telnyx signature check failed", e);
    return false;
  }
}

export async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Records the event id; false when it was already processed (Telnyx retry). */
export async function firstTime(id: string | undefined, type: string): Promise<boolean> {
  if (!id) return true;
  const db = await admin();
  const { error } = await db.from("webhook_events").insert({ event_id: id, event_type: type });
  return !error;
}

/** Appends to a lead's activity log (server side). */
export async function logOnLead(
  leadId: string,
  kind: string,
  text: string,
  extra: Partial<LeadRow> = {},
) {
  const db = await admin();
  const { data } = await db.from("leads").select("log").eq("id", leadId).maybeSingle();
  if (!data) return;
  const log = [...((data.log ?? []) as unknown[]), logEntry(kind, text)];
  await db
    .from("leads")
    .update({ ...extra, log: log as never, updated_at: new Date().toISOString() })
    .eq("id", leadId);
}

export async function findLeadByPhone(userId: string | null, phone: string | null) {
  const d = (phone ?? "").replace(/\D/g, "").slice(-10);
  if (d.length !== 10) return null;
  const db = await admin();
  let q = db.from("leads").select("*").eq("phone_digits", d);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.order("updated_at", { ascending: false }).limit(1);
  return (data?.[0] as LeadRow | undefined) ?? null;
}

export const sipUri = (username: string) => `sip:${username}@sip.telnyx.com`;
