import { createFileRoute } from "@tanstack/react-router";
import { optChange, toE164 } from "@/lib/call-rules";

/** Telnyx messaging webhooks: replies (incl. STOP/START) and delivery status. */
export const Route = createFileRoute("/api/public/telephony/sms-events")({
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
        if (!evt?.event_type) return new Response("Bad event", { status: 400 });
        const p = evt.payload ?? {};
        const db = await t.admin();
        try {
          if (evt.event_type === "message.received") {
            const to = toE164(p.to?.[0]?.phone_number ?? p.to);
            const from = toE164(p.from?.phone_number ?? p.from);
            const { data: num } = await db
              .from("phone_numbers")
              .select("user_id")
              .eq("phone_number", to ?? "")
              .maybeSingle();
            if (!num?.user_id || !from || !to) return new Response("ok");
            const userId = num.user_id;
            const text = String(p.text ?? "").slice(0, 2000);
            // Persist STOP before marking the event processed; failed writes stay retryable.
            const consent = await import("@/lib/sms-consent.server");
            await consent.handleKeyword(
              userId,
              from,
              to,
              text,
              !!p.autoresponse_type,
              String(evt.id ?? ""),
            );
            if (!(await t.firstTime(evt.id, evt.event_type))) return new Response("ok");
            const lead = await t.findLeadByPhone(userId, from);
            if (!userId) return new Response("ok");
            await db.from("sms_messages").insert({
              user_id: userId,
              lead_id: lead?.id ?? null,
              direction: "inbound",
              from_number: from,
              to_number: to,
              body: text,
              status: "received",
              telnyx_message_id: p.id ?? null,
            });
            if (lead) {
              const change = optChange(text, p.autoresponse_type);
              const extra =
                change === "stop"
                  ? { sms_opt_out: true }
                  : change === "start"
                    ? { sms_opt_out: false }
                    : {};
              const note =
                change === "stop"
                  ? `Replied ${text.trim().toUpperCase()}: texting stopped`
                  : change === "start"
                    ? `Replied ${text.trim().toUpperCase()}: texting allowed again`
                    : `Reply: ${text.slice(0, 120)}`;
              await t.logOnLead(lead.id, "Text", note, extra);
            }
          } else if (evt.event_type === "message.sent" || evt.event_type === "message.finalized") {
            const status =
              p.to?.[0]?.status ?? (evt.event_type === "message.sent" ? "sent" : "delivered");
            if (p.id)
              await db.from("sms_messages").update({ status }).eq("telnyx_message_id", p.id);
          }
        } catch (e) {
          return new Response("Retry", { status: 503 });
        }
        return new Response("ok");
      },
    },
  },
});
