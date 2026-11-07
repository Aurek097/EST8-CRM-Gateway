import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  callRuleFailure,
  encodeState,
  pickCallerId,
  textRuleFailure,
  toE164,
} from "@/lib/call-rules";
import { stateCode, type LeadRow } from "@/lib/leads";

type Ctx = { supabase: any; userId: string };

async function loadLead(ctx: Ctx, leadId: string) {
  const { data } = await ctx.supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!data) throw new Error("Lead not found.");
  return data as LeadRow;
}
async function loadMe(ctx: Ctx) {
  const [{ data: p }, { data: cfg }, { data: nums }] = await Promise.all([
    ctx.supabase.from("profiles").select("licensed_states, phone").eq("id", ctx.userId).single(),
    ctx.supabase.from("telephony_configs").select("*").eq("user_id", ctx.userId).maybeSingle(),
    ctx.supabase.from("phone_numbers").select("*").eq("user_id", ctx.userId),
  ]);
  return {
    licensed: (p?.licensed_states ?? []) as string[],
    phone: p?.phone as string | null,
    cfg,
    nums: (nums ?? []) as { phone_number: string; region: string | null; is_primary: boolean }[],
  };
}
async function isAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  return !!data;
}

/** Pre-dial check the browser shows before calling (the server re-checks on the call itself). */
export const callPreflight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const lead = await loadLead(context, data.leadId);
    const me = await loadMe(context);
    const t = await import("./telnyx.server");
    const reason = callRuleFailure(lead, me.licensed);
    const callerId = pickCallerId(
      me.nums,
      lead.state,
      me.cfg?.primary_caller_id ?? null,
      t.env("TELNYX_DEFAULT_CALLER_ID"),
    );
    return {
      ok: !reason && !!callerId,
      reason: reason ?? (callerId ? null : "You have no number to call from yet."),
      to: toE164(lead.phone),
      mode: (me.cfg?.calling_mode ?? "webrtc") as "webrtc" | "bridge",
    };
  });

/** Creates the agent's telephony credential on first use, then returns a 24-hour WebRTC login token. */
export const getRtcToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const t = await import("./telnyx.server");
    const connection = t.env("TELNYX_CREDENTIAL_CONNECTION_ID");
    if (!connection || !t.env("TELNYX_API_KEY"))
      return { error: "Phone service isn't set up yet." };
    const db = await t.admin();
    const { data: cfg } = await db
      .from("telephony_configs")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    let credId = cfg?.telnyx_credential_id ?? null;
    try {
      if (!credId) {
        const r = await t.tx("/telephony_credentials", {
          method: "POST",
          body: { connection_id: connection, name: `calldesk-${context.userId}` },
        });
        credId = r.data.id as string;
        await db.from("telephony_configs").upsert({
          user_id: context.userId,
          telnyx_credential_id: credId,
          sip_username: r.data.sip_username,
          updated_at: new Date().toISOString(),
        });
      }
      const token = await t.tx<string>(`/telephony_credentials/${credId}/token`, {
        method: "POST",
        raw: true,
      });
      return { token: token.trim() };
    } catch (e) {
      return { error: t.telnyxMessage(e) };
    }
  });

/** Cell Bridge: rings the agent's cell first; the webhook dials the lead when they answer. */
export const startBridgeCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const t = await import("./telnyx.server");
    const lead = await loadLead(context, data.leadId);
    const me = await loadMe(context);
    const reason = callRuleFailure(lead, me.licensed);
    if (reason) return { error: reason };
    const cell = toE164(me.cfg?.bridge_phone ?? me.phone);
    if (!cell)
      return { error: "Add your cell number in Settings (Cell Bridge) or your Profile phone." };
    const from = pickCallerId(
      me.nums,
      lead.state,
      me.cfg?.primary_caller_id ?? null,
      t.env("TELNYX_DEFAULT_CALLER_ID"),
    );
    const app = t.env("TELNYX_CALL_CONTROL_APP_ID");
    if (!from || !app) return { error: "Phone service isn't set up yet." };
    try {
      await t.tx("/calls", {
        method: "POST",
        body: {
          connection_id: app,
          to: cell,
          from,
          timeout_secs: 30,
          client_state: encodeState({ k: "agent_cell", u: context.userId, l: lead.id }),
        },
      });
      return { ok: true };
    } catch (e) {
      return { error: t.telnyxMessage(e) };
    }
  });

export const sendSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        leadId: z.string().uuid(),
        body: z.string().max(1500),
        promotional: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const t = await import("./telnyx.server");
    const lead = await loadLead(context, data.leadId);
    const me = await loadMe(context);
    const from = pickCallerId(
      me.nums,
      lead.state,
      me.cfg?.primary_caller_id ?? null,
      t.env("TELNYX_DEFAULT_CALLER_ID"),
    );
    const reason = textRuleFailure(lead, data.body, from);
    if (reason) return { error: reason };
    const consent = await import("./sms-consent.server");
    const consentReason = await consent.consentFailure(
      lead.user_id,
      toE164(lead.phone) ?? "",
      data.promotional,
    );
    if (consentReason) return { error: consentReason };
    const compliance = await import("./a2p.server");
    try {
      if (!(await compliance.verifySmsCompliance(lead.user_id, from)))
        return {
          error:
            "Business SMS is blocked until your brand is verified, campaign is carrier-provisioned and this number is associated. Complete A2P Registration in Settings.",
        };
    } catch {
      return { error: "SMS compliance status could not be verified. Please try again later." };
    }
    const db = await t.admin();
    try {
      const r = await t.tx("/messages", {
        method: "POST",
        body: {
          from,
          to: toE164(lead.phone),
          text: data.body,
          messaging_profile_id: t.env("TELNYX_MESSAGING_PROFILE_ID") ?? undefined,
        },
      });
      await db.from("sms_messages").insert({
        user_id: lead.user_id,
        lead_id: lead.id,
        direction: "outbound",
        from_number: from,
        to_number: toE164(lead.phone),
        body: data.body,
        status: "sent",
        telnyx_message_id: r.data?.id ?? null,
      });
      await t.logOnLead(
        lead.id,
        "Text",
        `Sent: ${data.body.slice(0, 80)}${data.body.length > 80 ? "…" : ""}`,
      );
      return { ok: true };
    } catch (e) {
      const msg = t.telnyxMessage(e);
      if (msg === "This lead replied STOP.")
        await db.from("leads").update({ sms_opt_out: true }).eq("id", lead.id);
      return { error: msg };
    }
  });

export const searchNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        areaCode: z
          .string()
          .regex(/^\d{3}$/)
          .optional(),
        state: z.string().length(2).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) return { error: "Only admins can buy numbers.", numbers: [] };
    const t = await import("./telnyx.server");
    const query: Record<string, string> = {
      "filter[country_code]": "US",
      "filter[features][]": "sms",
      "filter[limit]": "20",
    };
    if (data.areaCode) query["filter[national_destination_code]"] = data.areaCode;
    if (data.state) query["filter[administrative_area]"] = data.state.toUpperCase();
    try {
      const r = await t.tx("/available_phone_numbers", { query });
      return {
        numbers: (r.data ?? []).map((n: any) => ({
          phone: n.phone_number as string,
          city:
            (n.region_information ?? []).find((x: any) => x.region_type === "rate_center")
              ?.region_name ?? null,
          state:
            (n.region_information ?? []).find((x: any) => x.region_type === "state")?.region_name ??
            null,
          monthly: n.cost_information?.monthly_cost ?? null,
        })),
      };
    } catch (e) {
      return { error: t.telnyxMessage(e), numbers: [] };
    }
  });

export const buyNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        phone: z.string().regex(/^\+1\d{10}$/),
        state: z.string().nullable(),
        forUserId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) return { error: "Only admins can buy numbers." };
    const t = await import("./telnyx.server");
    const owner = data.forUserId ?? context.userId;
    try {
      const r = await t.tx("/number_orders", {
        method: "POST",
        body: {
          phone_numbers: [{ phone_number: data.phone }],
          connection_id: t.env("TELNYX_CALL_CONTROL_APP_ID") ?? undefined,
          messaging_profile_id: t.env("TELNYX_MESSAGING_PROFILE_ID") ?? undefined,
        },
      });
      const db = await t.admin();
      const { count } = await db
        .from("phone_numbers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", owner);
      await db.from("phone_numbers").insert({
        user_id: owner,
        phone_number: data.phone,
        region: stateCode(data.state),
        is_primary: !count,
        telnyx_id: r.data?.phone_numbers?.[0]?.id ?? r.data?.id ?? null,
      });
      return { ok: true };
    } catch (e) {
      return { error: t.telnyxMessage(e) };
    }
  });

export const releaseNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) return { error: "Only admins can release numbers." };
    const t = await import("./telnyx.server");
    const db = await t.admin();
    const { data: n } = await db.from("phone_numbers").select("*").eq("id", data.id).maybeSingle();
    if (!n) return { error: "Number not found." };
    try {
      await t.tx(`/phone_numbers/${encodeURIComponent(n.phone_number)}`, { method: "DELETE" });
    } catch (e) {
      return { error: t.telnyxMessage(e) };
    }
    await db.from("phone_numbers").delete().eq("id", data.id);
    return { ok: true };
  });

/** 10DLC brand and campaign status. */
export const a2pStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: r } = await context.supabase
      .from("a2p_registrations")
      .select("display_name,brand_status,campaign_status,blocker")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      configured: true,
      brands: r?.brand_status ? [{ name: r.display_name, status: r.brand_status }] : [],
      campaigns: r?.campaign_status ? [{ name: "Your campaign", status: r.campaign_status }] : [],
      error: r?.blocker ?? null,
    };
  });

/** Admin: which secrets are set (never their values) and the webhook URLs to paste into Telnyx. */
export const diagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context))) return { error: "Admins only." };
    const names = [
      "TELNYX_API_KEY",
      "TELNYX_PUBLIC_KEY",
      "TELNYX_CALL_CONTROL_APP_ID",
      "TELNYX_CREDENTIAL_CONNECTION_ID",
      "TELNYX_MESSAGING_PROFILE_ID",
      "TELNYX_DEFAULT_CALLER_ID",
    ];
    const t = await import("./telnyx.server");
    let apiOk: boolean | null = null;
    if (t.env("TELNYX_API_KEY")) {
      try {
        await t.tx("/balance");
        apiOk = true;
      } catch {
        apiOk = false;
      }
    }
    return { secrets: names.map((n) => ({ name: n, set: !!t.env(n) })), apiOk };
  });
