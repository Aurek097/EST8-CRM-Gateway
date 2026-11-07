import { createFileRoute } from "@tanstack/react-router";
import {
  type CallState,
  callRuleFailure,
  decodeState,
  encodeState,
  hangupOutcome,
  pickCallerId,
  toE164,
} from "@/lib/call-rules";
import type { LeadRow } from "@/lib/leads";

/** Every Telnyx call webhook. Signature-checked; each event handled once. */
export const Route = createFileRoute("/api/public/telephony/voice-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const t = await import("@/lib/telnyx.server");
        if (!(await t.verifyTelnyx(request, raw)))
          return new Response("Invalid signature", { status: 401 });
        let evt: any;
        try {
          evt = JSON.parse(raw)?.data;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        if (!evt?.event_type) return new Response("ok");
        if (!(await t.firstTime(evt.id, evt.event_type))) return new Response("ok");
        try {
          await handle(evt, t);
        } catch (e) {
          console.error("voice event failed", evt.event_type, e);
        }
        return new Response("ok");
      },
    },
  },
});

type T = typeof import("@/lib/telnyx.server");
const act = (t: T, ccid: string, action: string, body: Record<string, unknown> = {}) =>
  t
    .tx(`/calls/${encodeURIComponent(ccid)}/actions/${action}`, { method: "POST", body })
    .catch((e) => {
      console.error(`action ${action} failed`, e);
      return null;
    });

async function agentContext(t: T, userId: string) {
  const db = await t.admin();
  const [{ data: p }, { data: cfg }, { data: nums }] = await Promise.all([
    db.from("profiles").select("licensed_states, phone").eq("id", userId).single(),
    db.from("telephony_configs").select("*").eq("user_id", userId).maybeSingle(),
    db.from("phone_numbers").select("*").eq("user_id", userId),
  ]);
  return {
    licensed: (p?.licensed_states ?? []) as string[],
    phone: p?.phone ?? null,
    cfg,
    nums: nums ?? [],
  };
}

async function dialLead(
  t: T,
  userId: string,
  leadId: string,
  agentCcid: string,
): Promise<string | null> {
  const db = await t.admin();
  const { data: lead } = await db
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();
  const a = await agentContext(t, userId);
  // Admins may call leads in an agent's book they opened; fall back to an unscoped read for admins.
  let l = lead as LeadRow | null;
  if (!l) {
    const { data: isAdm } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (isAdm)
      l = (await db.from("leads").select("*").eq("id", leadId).maybeSingle())
        .data as LeadRow | null;
  }
  if (!l) return "This lead couldn't be found.";
  const reason = callRuleFailure(l, a.licensed);
  if (reason) return reason;
  const from = pickCallerId(
    a.nums,
    l.state,
    a.cfg?.primary_caller_id ?? null,
    t.env("TELNYX_DEFAULT_CALLER_ID"),
  );
  const app = t.env("TELNYX_CALL_CONTROL_APP_ID");
  if (!from || !app) return "You have no number to call from yet.";
  try {
    await t.tx("/calls", {
      method: "POST",
      body: {
        connection_id: app,
        to: toE164(l.phone),
        from,
        timeout_secs: 30,
        client_state: encodeState({
          k: "lead",
          a: agentCcid,
          u: userId,
          l: l.id,
          rec: a.cfg?.record_calls ? 1 : 0,
        }),
      },
    });
    return null;
  } catch (e) {
    return t.telnyxMessage(e);
  }
}

async function handle(evt: any, t: T) {
  const p = evt.payload ?? {};
  const ccid: string = p.call_control_id;
  const cs = decodeState(p.client_state);
  const db = await t.admin();

  switch (evt.event_type) {
    case "call.initiated": {
      const credConn = t.env("TELNYX_CREDENTIAL_CONNECTION_ID");
      if (p.direction === "outgoing" && credConn && String(p.connection_id) === credConn && !cs.k) {
        // Parked browser call: find the agent from their SIP username, check rules, then dial the lead.
        const user =
          String(p.from ?? "")
            .replace(/^sip:/, "")
            .split("@")[0] ?? "";
        const { data: cfg } = await db
          .from("telephony_configs")
          .select("user_id")
          .eq("sip_username", user)
          .maybeSingle();
        const leadId = cs.l ?? cs.leadId;
        if (!cfg || !leadId) {
          await act(t, ccid, "answer", {
            client_state: encodeState({
              k: "reject",
              r: "This call isn't linked to a lead. Start calls from the lead's Call button.",
            }),
          });
          return;
        }
        const reason = await dialLead(t, cfg.user_id, leadId, ccid);
        if (reason)
          await act(t, ccid, "answer", { client_state: encodeState({ k: "reject", r: reason }) });
        return;
      }
      if (
        p.direction === "incoming" &&
        String(p.connection_id) === t.env("TELNYX_CALL_CONTROL_APP_ID")
      ) {
        const to = toE164(p.to);
        const { data: num } = await db
          .from("phone_numbers")
          .select("user_id")
          .eq("phone_number", to ?? "")
          .maybeSingle();
        const lead = num ? await t.findLeadByPhone(num.user_id, p.from) : null;
        await act(t, ccid, "answer", {
          client_state: encodeState({
            k: "inbound",
            u: num?.user_id ?? "",
            l: lead?.id ?? "",
            f: p.from ?? "",
          }),
        });
      }
      return;
    }
    case "call.answered": {
      if (cs.k === "reject") {
        await act(t, ccid, "speak", {
          payload: cs.r ?? "This call can't be placed.",
          voice: "female",
          language: "en-US",
          client_state: p.client_state,
        });
        return;
      }
      if (cs.k === "lead" && cs.a) {
        await act(t, ccid, "bridge", {
          call_control_id: cs.a,
          client_state: encodeState({ ...cs, ans: 1 }),
        });
        if (cs.rec === "1")
          await act(t, ccid, "record_start", {
            format: "mp3",
            channels: "dual",
            client_state: encodeState({ ...cs, ans: 1 }),
          });
        return;
      }
      if (cs.k === "agent_cell") {
        const reason = await dialLead(t, cs.u!, cs.l!, ccid);
        if (reason)
          await act(t, ccid, "speak", {
            payload: reason,
            voice: "female",
            language: "en-US",
            client_state: encodeState({ k: "reject", r: reason }),
          });
        return;
      }
      if (cs.k === "inbound") {
        await ringNext(t, ccid, cs, 1);
        return;
      }
      if (cs.k === "ring" && cs.i) {
        await act(t, ccid, "bridge", {
          call_control_id: cs.i,
          client_state: encodeState({ ...cs, ans: 1 }),
        });
        return;
      }
      return;
    }
    case "call.speak.ended": {
      if (cs.k === "reject") await act(t, ccid, "hangup");
      if (cs.k === "vm")
        await act(t, ccid, "record_start", {
          format: "mp3",
          channels: "single",
          max_length: 120,
          play_beep: true,
          client_state: p.client_state,
        });
      return;
    }
    case "call.hangup": {
      const answered = cs.ans === "1";
      if (cs.k === "lead" && cs.u) {
        const secs =
          answered && p.start_time && p.end_time
            ? Math.max(0, Math.round((Date.parse(p.end_time) - Date.parse(p.start_time)) / 1000))
            : 0;
        const outcome = hangupOutcome(p.hangup_cause, answered);
        await db.from("call_logs").insert({
          user_id: cs.u,
          lead_id: cs.l ?? null,
          call_control_id: ccid,
          outcome,
          duration_seconds: secs,
        });
        if (cs.l) {
          const { data: l } = await db.from("leads").select("dials").eq("id", cs.l).maybeSingle();
          await t.logOnLead(
            cs.l,
            "Call",
            `Call ${outcome}${secs ? ` · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : ""}`,
            { dials: (l?.dials ?? 0) + 1, last_dial: new Date().toISOString() },
          );
        }
        if (!answered && cs.a) await act(t, cs.a, "hangup");
        return;
      }
      if (cs.k === "ring" && !answered && cs.i) {
        await ringNext(t, cs.i, { ...cs, k: "inbound" }, Number(cs.n ?? 1) + 1);
        return;
      }
      return;
    }
    case "call.recording.saved": {
      const url = p.recording_urls?.mp3 ?? p.public_recording_urls?.mp3;
      if (!url || !cs.u) return;
      if (cs.k === "vm") {
        await db.from("call_logs").insert({
          user_id: cs.u,
          lead_id: cs.l || null,
          call_control_id: ccid,
          outcome: "voicemail",
          notes: url,
        });
        if (cs.l)
          await t.logOnLead(cs.l, "Voicemail", `Voicemail from ${cs.f ?? "caller"}: ${url}`);
      } else if (cs.l) {
        await t.logOnLead(cs.l, "Recording", `Call recording: ${url}`);
      }
      return;
    }
  }
}

/** Inbound: browser for 20 s, then cell for 25 s, then the greeting and a 2-minute voicemail. */
async function ringNext(t: T, inboundCcid: string, cs: CallState, step: number): Promise<void> {
  const app = t.env("TELNYX_CALL_CONTROL_APP_ID");
  const u = cs.u;
  if (u && app && step <= 2) {
    const db = await t.admin();
    const [{ data: cfg }, { data: prof }] = await Promise.all([
      db.from("telephony_configs").select("*").eq("user_id", u).maybeSingle(),
      db.from("profiles").select("phone").eq("id", u).maybeSingle(),
    ]);
    const target =
      step === 1
        ? cfg?.sip_username
          ? t.sipUri(cfg.sip_username)
          : null
        : toE164(cfg?.bridge_phone ?? prof?.phone ?? null);
    if (target) {
      try {
        await t.tx("/calls", {
          method: "POST",
          body: {
            connection_id: app,
            to: target,
            from: toE164(cs.f) ?? t.env("TELNYX_DEFAULT_CALLER_ID"),
            timeout_secs: step === 1 ? 20 : 25,
            client_state: encodeState({
              k: "ring",
              i: inboundCcid,
              u,
              l: cs.l ?? "",
              f: cs.f ?? "",
              n: step,
            }),
          },
        });
        return;
      } catch {
        /* fall through to the next step */
      }
    }
    if (step === 1) return ringNext(t, inboundCcid, cs, 2);
  }
  await act(t, inboundCcid, "speak", {
    payload:
      "Thank you for calling EST8 Financial Group. We're helping another family right now. Please leave your name, number and the best time to reach you after the tone.",
    voice: "female",
    language: "en-US",
    client_state: encodeState({ k: "vm", u: u ?? "", l: cs.l ?? "", f: cs.f ?? "" }),
  });
}
