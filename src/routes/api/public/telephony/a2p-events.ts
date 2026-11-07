import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/telephony/a2p-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const t = await import("@/lib/telnyx.server");
        const raw = await request.text();
        if (raw.length > 100000 || !(await t.verifyTelnyx(request, raw)))
          return new Response("Unauthorized", { status: 401 });
        let event: any;
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Invalid event", { status: 400 });
        }
        const payload = event.data?.payload ?? event.payload ?? {};
        const brand = payload.brandId ?? payload.brand_id,
          campaign = payload.campaignId ?? payload.campaign_id;
        if (typeof brand !== "string" && typeof campaign !== "string")
          return new Response("Ignored", { status: 200 });
        const db = await t.admin();
        const query = db.from("a2p_registrations").select("*");
        const { data: rows, error } =
          typeof brand === "string"
            ? await query.eq("brand_id", brand)
            : await query.eq("campaign_id", campaign);
        if (error) return new Response("Retry", { status: 503 });
        const a = await import("@/lib/a2p.server");
        try {
          for (const r of rows ?? []) await a.synchronize(r);
        } catch {
          return new Response("Retry", { status: 503 });
        }
        // Re-reading authoritative status is idempotent; retry deliveries need no payload persistence.
        return new Response("OK");
      },
    },
  },
});
