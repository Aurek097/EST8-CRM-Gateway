import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { businessSchema, campaignSchema } from "./a2p-rules";

export const getA2p = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const a = await import("./a2p.server");
    return a.getView(context);
  });
const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), business: businessSchema, campaign: campaignSchema }),
  z.object({ action: z.literal("review"), kind: z.enum(["brand", "campaign"]) }),
  z.object({
    action: z.literal("submit"),
    kind: z.enum(["brand", "campaign"]),
    authorized: z.literal(true),
  }),
  z.object({ action: z.literal("sync") }),
  z.object({ action: z.literal("otpSend"), authorized: z.literal(true) }),
  z.object({ action: z.literal("otpVerify"), pin: z.string().regex(/^\d{4,10}$/) }),
  z.object({ action: z.literal("assign"), phone: z.string().regex(/^\+1\d{10}$/) }),
  z.object({
    action: z.literal("appeal"),
    reason: z.string().trim().min(20).max(2000),
    sample1: z.string().trim().min(1).max(255),
    sample2: z.string().trim().min(1).max(255),
    authorized: z.literal(true),
  }),
  z.object({ action: z.literal("suspend"), id: z.string().uuid(), suspended: z.boolean() }),
  z.object({
    action: z.literal("fees"),
    brand: z.number().min(0).max(10000),
    review: z.number().min(0).max(10000),
    source: z.string().trim().min(10).max(1000),
  }),
]);
export type A2pAction = z.infer<typeof actions>;
export const changeA2p = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => actions.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    const a = await import("./a2p.server");
    try {
      return await a.change(context, data);
    } catch (e) {
      return { ok: false, message: a.safeMessage(e) };
    }
  });
export const adminA2p = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const a = await import("./a2p.server");
    return a.adminView(context);
  });
