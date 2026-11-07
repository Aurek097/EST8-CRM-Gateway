import { z } from "zod";
import { admin } from "./telnyx.server";
import { encrypt, decrypt, api, safeMessage, capabilities } from "./a2p.server";
import {
  defaultAgency,
  agencySchema,
  preparedCampaign,
  DISCLOSURE_VERSION,
  PUBLIC_OPTIN_URL,
  consentDisclosure,
  canInherit,
  type AgencyProfile,
} from "./agency-a2p-rules";
import { brandVerified, campaignApproved, businessErrors, draftEntities } from "./a2p-rules";
type Context = { userId: string; supabase: any };
async function mustAdmin(ctx: Context) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  const { data: p } = await ctx.supabase
    .from("profiles")
    .select("is_active")
    .eq("id", ctx.userId)
    .single();
  if (!data || !p?.is_active) throw new Error("Active administrators only.");
}
async function check(result: any) {
  if (result.error) throw new Error("Could not save agency information securely.");
  return result.data;
}
export async function agency() {
  const db = await admin();
  const row = await check(
    await db.from("a2p_agency_profile").select("*").eq("id", "est8").maybeSingle(),
  );
  return {
    profile: row ? agencySchema.parse(await decrypt(row.ciphertext)) : defaultAgency,
    updatedAt: row?.updated_at ?? null,
  };
}
export async function formVerified() {
  const db = await admin(),
    a = await agency();
  const row = await check(
    await db.from("a2p_public_form_verification").select("*").eq("id", "est8").maybeSingle(),
  );
  return (
    !!row?.verified_at &&
    row.profile_updated_at === a.updatedAt &&
    a.profile.verified &&
    a.profile.campaign.optinUrl === PUBLIC_OPTIN_URL
  );
}
export async function member(userId: string) {
  const db = await admin();
  const m = await check(
    await db.from("a2p_agency_members").select("authorized").eq("user_id", userId).maybeSingle(),
  );
  return m?.authorized === true;
}
export async function onboarding(ctx: Context) {
  const { data: p } = await ctx.supabase
    .from("profiles")
    .select("is_active")
    .eq("id", ctx.userId)
    .single();
  if (!p?.is_active) throw new Error("Active team access is required.");
  const a = await agency(),
    allowed = await member(ctx.userId),
    live = await formVerified();
  const b = {
    ...a.profile.business,
    ein: a.profile.business.ein ? "•••••••••" : "",
    legalAuthority: false,
  };
  return {
    eligible: canInherit("est8", allowed, a.profile.verified),
    agencyVerified: a.profile.verified,
    business: b,
    campaign: preparedCampaign(a.profile, live),
    formVerified: live,
    supportEmail: a.profile.supportEmail,
    supportPhone: a.profile.supportPhone,
    sharedAvailable: !!a.profile.brandId && !!a.profile.campaignId && !!a.profile.registrationOwner,
  };
}
export async function agencyAdminView(ctx: Context) {
  await mustAdmin(ctx);
  const a = await agency(),
    db = await admin();
  return {
    profile: {
      ...a.profile,
      business: { ...a.profile.business, ein: a.profile.business.ein ? "•••••••••" : "" },
    },
    members: await check(await db.from("a2p_agency_members").select("*")),
    agents: await check(await ctx.supabase.from("profiles").select("id,full_name,email")),
    corrections: await check(
      await db
        .from("a2p_correction_requests")
        .select("*")
        .order("created_at", { ascending: false }),
    ),
    formVerified: await formVerified(),
    capability: await capabilities(),
  };
}
export const adminActionSchema = z.discriminatedUnion("action", [
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
export async function adminChange(ctx: Context, input: z.infer<typeof adminActionSchema>) {
  await mustAdmin(ctx);
  const db = await admin();
  const allowed = await check(
    await db.rpc("a2p_take_rate_limit", {
      p_user: ctx.userId,
      p_action: `agency-${input.action}`,
      p_seconds: 5,
    }),
  );
  if (!allowed) throw new Error("Please wait before repeating this action.");
  if (input.action === "recheck") {
    const cap = await capabilities(true);
    return {
      ok: cap.capability.ok,
      message: cap.capability.blocker ?? "Telnyx eligibility checked. No registrations submitted.",
    };
  }
  if (input.action === "member") {
    await check(
      await db.from("a2p_agency_members").upsert({
        user_id: input.userId,
        authorized: input.authorized,
        authorized_by: ctx.userId,
        reason: input.reason,
        updated_at: new Date().toISOString(),
      }),
    );
    return { ok: true, message: "Legal-sender authorization updated." };
  }
  if (input.action === "save") {
    const old = await agency();
    const profile = input.profile;
    if (profile.business.ein === "•••••••••") profile.business.ein = old.profile.business.ein;
    profile.business.vertical = "INSURANCE";
    if (profile.verified) {
      const errors = businessErrors({ ...profile.business, legalAuthority: true }, draftEntities, [
        "INSURANCE",
      ]);
      if (
        errors.length ||
        !profile.verificationReference ||
        !z.string().email().safeParse(profile.supportEmail).success ||
        !/^\+\d{8,15}$/.test(profile.supportPhone)
      )
        throw new Error(
          "Complete legal business details, verified support contacts and a verification reference before marking this profile verified.",
        );
    }
    await check(
      await db.from("a2p_agency_profile").upsert({
        id: "est8",
        ciphertext: await encrypt(profile),
        verified_at: profile.verified ? new Date().toISOString() : null,
        verified_by: profile.verified ? ctx.userId : null,
        updated_at: new Date().toISOString(),
      }),
    );
    await check(
      await db
        .from("a2p_public_form_verification")
        .upsert({ id: "est8", verified_at: null, disclosure_version: DISCLOSURE_VERSION }),
    );
    return {
      ok: true,
      message:
        "Agency profile saved securely. Public consent verification must be renewed after changes.",
    };
  }
  const a = await agency();
  if (
    !a.profile.verified ||
    !a.profile.campaign.privacyPolicyLink ||
    !a.profile.campaign.termsAndConditionsLink ||
    a.profile.campaign.optinUrl !== PUBLIC_OPTIN_URL
  )
    throw new Error(
      "Verify the legal profile, privacy/terms URLs and the published EST8 consent page first.",
    );
  // Fixed trusted URL only; never fetch arbitrary business URLs or internal hosts.
  const response = await fetch(PUBLIC_OPTIN_URL, {
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  const html = await response.text();
  if (
    !response.ok ||
    !html.includes(`data-consent-version="${DISCLOSURE_VERSION}"`) ||
    !html.includes("SMS consent") ||
    !html.includes(a.profile.campaign.privacyPolicyLink)
  )
    throw new Error(
      "The published consent form is not yet available with the current disclosures. Publish and test it first.",
    );
  const { count } = await db
    .from("sms_consent_events")
    .select("id", { count: "exact", head: true })
    .eq("source", PUBLIC_OPTIN_URL)
    .eq("disclosure_version", DISCLOSURE_VERSION);
  if (!count)
    throw new Error(
      "Submit a draft-only test inquiry through the functioning public form before verifying it.",
    );
  await check(
    await db.from("a2p_public_form_verification").upsert({
      id: "est8",
      verified_at: new Date().toISOString(),
      verified_by: ctx.userId,
      source: input.reference,
      disclosure_version: DISCLOSURE_VERSION,
      profile_updated_at: a.updatedAt,
    }),
  );
  return { ok: true, message: "Published consent process verified. No registration submitted." };
}
export async function reuse(ctx: Context) {
  const { data: active } = await ctx.supabase
    .from("profiles")
    .select("is_active")
    .eq("id", ctx.userId)
    .single();
  if (!active?.is_active) throw new Error("Active agent access is required.");
  const a = await agency();
  if (!canInherit("est8", await member(ctx.userId), a.profile.verified) || !(await formVerified()))
    throw new Error(
      "Verified agency identity, published consent evidence and your legal-sender authorization are required.",
    );
  const cap = await capabilities();
  if (!cap.capability.ok) throw new Error(cap.capability.blocker ?? "Telnyx access is restricted.");
  if (!a.profile.brandId || !a.profile.campaignId || !a.profile.registrationOwner)
    throw new Error(
      "Your administrator must identify the existing approved agency registration owner.",
    );
  const [b, c] = await Promise.all([
    api(`/10dlc/brand/${encodeURIComponent(a.profile.brandId)}`),
    api(`/10dlc/campaign/${encodeURIComponent(a.profile.campaignId)}`),
  ]);
  const brand = b.data ?? b,
    campaign = c.data ?? c;
  if (
    !brandVerified(brand.identityStatus) ||
    !campaignApproved(campaign.campaignStatus) ||
    campaign.brandId !== a.profile.brandId ||
    brand.companyName?.toLowerCase() !== a.profile.business.companyName.toLowerCase() ||
    campaign.usecase !== a.profile.campaign.usecase
  )
    throw new Error(
      "Existing registration does not match the verified business/program or is not carrier-provisioned.",
    );
  const db = await admin();
  const owner = await check(
    await db
      .from("a2p_registrations")
      .select("*")
      .eq("user_id", a.profile.registrationOwner)
      .maybeSingle(),
  );
  if (
    !owner ||
    owner.brand_id !== a.profile.brandId ||
    owner.campaign_id !== a.profile.campaignId ||
    owner.suspended
  )
    throw new Error(
      "The existing registration must already belong to the verified agency owner in CallDesk.",
    );
  const own = await check(
    await db.from("a2p_registrations").select("*").eq("user_id", ctx.userId).maybeSingle(),
  );
  if (own?.brand_id || own?.campaign_id || own?.agency_registration_id)
    throw new Error(
      "Your account already has a registration. No replacement or duplicate was created.",
    );
  const row = await check(
    await db
      .from("a2p_registrations")
      .upsert(
        {
          user_id: ctx.userId,
          relationship: "est8",
          agency_registration_id: owner.id,
          display_name: a.profile.business.displayName,
          stage: "submitted",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single(),
  );
  await check(
    await db.from("a2p_private").upsert({
      registration_id: row.id,
      ciphertext: await encrypt({
        business: a.profile.business,
        campaign: preparedCampaign(a.profile, true),
      }),
    }),
  );
  await check(
    await db.from("a2p_audit").insert({
      actor_id: ctx.userId,
      registration_id: row.id,
      event: "agency_registration_reuse_authorized",
    }),
  );
  return {
    ok: true,
    message:
      "Approved agency registration linked without creating a paid duplicate. Confirm your number association next.",
  };
}
export async function publicConfig() {
  const a = await agency();
  if (
    !a.profile.verified ||
    !a.profile.registrationOwner ||
    !a.profile.campaign.privacyPolicyLink ||
    !a.profile.campaign.termsAndConditionsLink
  )
    return null;
  return {
    sender: a.profile.business.displayName,
    privacy: a.profile.campaign.privacyPolicyLink,
    terms: a.profile.campaign.termsAndConditionsLink,
    marketing: a.profile.campaign.marketing,
    version: DISCLOSURE_VERSION,
  };
}
export const inquirySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(100),
  phone: z.string().regex(/^\+1\d{10}$/),
  transactional: z.boolean(),
  marketing: z.boolean(),
  requestId: z.string().uuid(),
  version: z.literal(DISCLOSURE_VERSION),
  website: z.string().max(100).default(""),
});
export async function saveInquiry(input: z.infer<typeof inquirySchema>) {
  if (input.website) return { ok: true, message: "Inquiry received." };
  const a = await agency(),
    config = await publicConfig();
  if (!config) throw new Error("The agency's public inquiry form is not configured yet.");
  if (input.marketing && !config.marketing)
    throw new Error("Marketing consent is not available for this program.");
  const db = await admin();
  const prior = await check(
    await db
      .from("sms_consent_events")
      .select("id")
      .eq("request_id", input.requestId)
      .maybeSingle(),
  );
  if (prior) return { ok: true, message: "Inquiry already received." };
  const rate = await check(
    await db.rpc("a2p_take_rate_limit", {
      p_user: a.profile.registrationOwner,
      p_action: `public-inquiry:${input.phone}`,
      p_seconds: 60,
    }),
  );
  if (!rate) throw new Error("Please wait before submitting another inquiry.");
  const disclosure =
    consentDisclosure(config.sender, config.privacy, config.terms, false) +
    (input.marketing
      ? `\n${consentDisclosure(config.sender, config.privacy, config.terms, true)}`
      : "");
  await check(
    await db.from("sms_consent_events").insert({
      user_id: a.profile.registrationOwner,
      phone_number: input.phone,
      transactional: input.transactional,
      marketing: input.marketing,
      source: PUBLIC_OPTIN_URL,
      disclosure_version: DISCLOSURE_VERSION,
      disclosure,
      request_id: input.requestId,
    }),
  );
  const digits = input.phone.slice(-10);
  const existing = await check(
    await db
      .from("leads")
      .select("id")
      .eq("user_id", a.profile.registrationOwner)
      .eq("phone_digits", digits)
      .limit(1),
  );
  if (!existing?.length)
    await check(
      await db.from("leads").insert({
        user_id: a.profile.registrationOwner,
        first_name: input.name,
        email: input.email,
        phone: input.phone,
        phone_digits: digits,
        status: "new",
        lead_type: "mp",
        lead_source: "Public insurance inquiry",
        lead_date: new Date().toISOString(),
        data: {},
        log: [],
      }),
    );
  return {
    ok: true,
    message: "Inquiry received. Your optional consent choices have been recorded.",
  };
}
