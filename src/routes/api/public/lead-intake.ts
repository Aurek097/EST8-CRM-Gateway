import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { digits, logEntry, stateCode } from "@/lib/leads";

const s = (max = 200) =>
  z
    .union([z.string().max(max), z.number()])
    .transform(String)
    .optional()
    .nullable();
const Lead = z
  .object({
    first_name: s(),
    last_name: s(),
    phone: s(40),
    email: s(),
    address: s(300),
    city: s(),
    state: s(40),
    zip: s(20),
    lead_type: z.enum(["mp", "fe"]).optional(),
    source: s(),
    trusted_form: s(500),
    dob: s(20),
    loan_amount: s(40),
    lender: s(),
    amount_requested: s(40),
    beneficiary: s(),
    notes: s(1000),
  })
  .passthrough();

/**
 * Real-time lead intake for vendors and the agent's own forms.
 * Each agent has a private intake key (Settings); send it as ?key=… or the x-intake-key header.
 */
export const Route = createFileRoute("/api/public/lead-intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key =
          request.headers.get("x-intake-key") ?? new URL(request.url).searchParams.get("key");
        if (!key || key.length < 32)
          return Response.json({ error: "Missing intake key" }, { status: 401 });
        let body: unknown;
        try {
          const ct = request.headers.get("content-type") ?? "";
          body =
            ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")
              ? Object.fromEntries((await request.formData()).entries())
              : await request.json();
        } catch {
          return Response.json({ error: "Body must be JSON or form data" }, { status: 400 });
        }
        const parsed = Lead.safeParse(body);
        if (!parsed.success)
          return Response.json(
            { error: "Invalid lead", issues: parsed.error.issues.slice(0, 5) },
            { status: 400 },
          );
        const l = parsed.data;

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: owner } = await db
          .from("profiles")
          .select("id, is_active")
          .eq("intake_key", key)
          .maybeSingle();
        if (!owner?.is_active)
          return Response.json({ error: "Unknown intake key" }, { status: 401 });

        const phoneDigits = digits(l.phone) || null;
        if (!phoneDigits && !l.first_name && !l.last_name)
          return Response.json({ error: "A lead needs a name or phone" }, { status: 400 });
        if (phoneDigits) {
          const { data: dup } = await db
            .from("leads")
            .select("id")
            .eq("user_id", owner.id)
            .eq("phone_digits", phoneDigits)
            .limit(1);
          if (dup?.length) return Response.json({ ok: true, duplicate: true });
        }
        const source = l.source || "Lead intake";
        const type = l.lead_type ?? (l.amount_requested && !l.loan_amount ? "fe" : "mp");
        const data: Record<string, string> = {};
        if (l.dob) data["dob"] = l.dob;
        if (l.loan_amount) data["loanAmount"] = l.loan_amount;
        if (l.lender) data["lender"] = l.lender;
        if (l.amount_requested) data["amountRequested"] = l.amount_requested;
        if (l.beneficiary) data["beneficiary"] = l.beneficiary;
        if (l.trusted_form) data["trustedForm"] = l.trusted_form;
        const now = new Date();
        const log = [logEntry("Import", `Imported from ${source}`, now)];
        if (l.notes) log.push(logEntry("Note", l.notes, now));
        const { error } = await db.from("leads").insert({
          user_id: owner.id,
          first_name: l.first_name ?? null,
          last_name: l.last_name ?? null,
          phone: l.phone ?? null,
          phone_digits: phoneDigits,
          email: l.email ?? null,
          address: l.address ?? null,
          city: l.city ?? null,
          state: stateCode(l.state) ?? l.state ?? null,
          zip: l.zip ?? null,
          lead_type: type,
          lead_source: source,
          lead_date: now.toISOString(),
          status: "new",
          data: data as never,
          log: log as never,
        });
        if (error) {
          console.error("lead intake insert failed", error);
          return Response.json({ error: "Couldn't save the lead" }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
