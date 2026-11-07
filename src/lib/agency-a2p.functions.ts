import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { agencySchema, DISCLOSURE_VERSION } from "./agency-a2p-rules";
export const getOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await import("./agency-a2p.server")).onboarding(context));
export const getAgencyAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await import("./agency-a2p.server")).agencyAdminView(context));
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), profile: agencySchema }),
  z.object({
    action: z.literal("member"),
    userId: z.string().uuid(),
    authorized: z.boolean(),
    reason: z.string().trim().min(10).max(500),
  }),
  z.object({
    action: z.literal("verifyForm"),
    reference: z.string().trim().min(10).max(500),
    confirmed: z.literal(true),
  }),
  z.object({ action: z.literal("recheck") }),
]);
export const changeAgency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    try {
      return await (await import("./agency-a2p.server")).adminChange(context, data);
    } catch (e) {
      return { ok: false, message: (await import("./a2p.server")).safeMessage(e) };
    }
  });
export const reuseAgency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ authorized: z.literal(true) }).parse(d))
  .handler(async ({ context }) => {
    try {
      return await (await import("./agency-a2p.server")).reuse(context);
    } catch (e) {
      return { ok: false, message: (await import("./a2p.server")).safeMessage(e) };
    }
  });
export const requestCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ request: z.string().trim().min(10).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (
      await import("./telnyx.server")
    )
      .admin()
      .then((db) =>
        db
          .from("a2p_correction_requests")
          .insert({ user_id: context.userId, request: data.request }),
      );
    return { ok: !error };
  });
export const getPublicConsent = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return await (await import("./agency-a2p.server")).publicConfig();
  } catch {
    return null;
  }
});
const inquiry = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(100),
  phone: z.string().regex(/^\+1\d{10}$/),
  transactional: z.boolean(),
  marketing: z.boolean(),
  requestId: z.string().uuid(),
  version: z.literal(DISCLOSURE_VERSION),
  website: z.string().max(100).default(""),
});
export const submitInquiry = createServerFn({ method: "POST" })
  .inputValidator((d) => inquiry.parse(d))
  .handler(async ({ data }) => {
    try {
      return await (await import("./agency-a2p.server")).saveInquiry(data);
    } catch {
      return {
        ok: false,
        message: "Inquiry could not be saved. Check your details or try again shortly.",
      };
    }
  });
