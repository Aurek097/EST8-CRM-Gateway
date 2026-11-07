import {
  emptyBusiness,
  emptyCampaign,
  businessErrors,
  campaignErrors,
  brandVerified,
  campaignApproved,
  onceOnly,
  smsReady,
  draftEntities,
  draftUsecases,
} from "./a2p-rules";
import type { A2pAction } from "./a2p.functions";
import type { A2PView, Registration, Fees } from "./a2p-types";
import { admin, env, TelnyxError } from "./telnyx.server";

type Context = { userId: string; supabase: any };
const APP = "https://est8-symmetry-gateway.lovable.app";
const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function encryptionKey() {
  const secret = env("A2P_ENCRYPTION_KEY");
  if (!secret) throw new Error("Secure registration storage is not configured.");
  return crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encrypt(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...new Uint8Array(data)))}`;
}
export async function decrypt(value: string) {
  const [iv, data] = value.split(".");
  if (!iv || !data) throw new Error("Secure draft could not be opened.");
  return JSON.parse(
    new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytes(iv) },
        await encryptionKey(),
        bytes(data),
      ),
    ),
  );
}
// Dedicated transport: never logs provider request/response bodies or business identifiers.
export async function api(path: string, method = "GET", body?: unknown): Promise<any> {
  const key = env("TELNYX_API_KEY");
  if (!key) throw new Error("Telnyx is not connected.");
  const r = await fetch(`https://api.telnyx.com/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : null,
    signal: AbortSignal.timeout(20000),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new TelnyxError(r.status, JSON.stringify(json), json.errors?.[0]?.code ?? null);
  return json;
}
export function safeMessage(e: unknown) {
  if (e instanceof TelnyxError) {
    if ([401, 403].includes(e.status))
      return `Telnyx denied 10DLC API access (HTTP ${e.status}${e.code ? `, code ${e.code}` : ""}). Your account needs registration permission or an upgrade. Your draft is retained.`;
    return `Telnyx could not complete this operation (HTTP ${e.status}${e.code ? `, code ${e.code}` : ""}). Review the registration fields; no approval has been assumed.`;
  }
  return e instanceof Error && !(e instanceof TypeError)
    ? e.message
    : "Registration service is unavailable. Your draft is retained.";
}
async function checked<T>(result: { data: T | null; error: any }): Promise<T> {
  if (result.error) throw new Error("Registration could not be saved securely. Please retry.");
  return result.data as T;
}
async function authorized(ctx: Context) {
  const { data } = await ctx.supabase
    .from("profiles")
    .select("is_active")
    .eq("id", ctx.userId)
    .single();
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (!data?.is_active || !roles?.length) throw new Error("Active team access is required.");
}
async function requireAdmin(ctx: Context) {
  await authorized(ctx);
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Administrators only.");
}
async function own(ctx: Context): Promise<Registration | null> {
  await authorized(ctx);
  return checked(
    await ctx.supabase
      .from("a2p_registrations")
      .select("*")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
  );
}
async function privateDraft(id: string) {
  const db = await admin();
  const row = await checked<any>(
    await db.from("a2p_private").select("ciphertext").eq("registration_id", id).maybeSingle(),
  );
  return row ? decrypt(row.ciphertext) : { business: emptyBusiness, campaign: emptyCampaign };
}
function enumValues(value: any): string[] {
  const rows = value?.data ?? value?.records ?? value;
  if (Array.isArray(rows))
    return rows
      .map((x) => (typeof x === "string" ? x : (x.id ?? x.value ?? x.code)))
      .filter((x): x is string => typeof x === "string");
  return rows && typeof rows === "object" ? Object.keys(rows) : [];
}
export async function capabilities(force = false) {
  const db = await admin();
  const cache = await checked<any>(
    await db.from("a2p_capability_cache").select("*").eq("id", "telnyx").maybeSingle(),
  );
  if (!force && cache && (!cache.allowed || Date.now() - Date.parse(cache.checked_at) < 3600000))
    return {
      capability: { ok: cache.allowed, blocker: cache.blocker },
      enums: cache.enums as A2PView["enums"],
    };
  let result;
  try {
    const [entities, verticals, usecases, exchanges] = await Promise.all(
      ["entityType", "vertical", "usecase", "stockExchange"].map((x) => api(`/10dlc/enum/${x}`)),
    );
    // The authenticated brand list verifies account access, not just public enum availability.
    await api("/10dlc/brand?recordsPerPage=1");
    result = {
      capability: { ok: true, blocker: null },
      enums: {
        entities: enumValues(entities),
        verticals: enumValues(verticals),
        usecases: enumValues(usecases),
        exchanges: enumValues(exchanges),
      },
    };
  } catch (e) {
    result = {
      capability: { ok: false, blocker: safeMessage(e) },
      enums: {
        entities: draftEntities,
        verticals: ["INSURANCE"],
        usecases: draftUsecases,
        exchanges: ["NASDAQ", "NYSE"],
      },
    };
  }
  await checked(
    await db.from("a2p_capability_cache").upsert({
      id: "telnyx",
      allowed: result.capability.ok,
      blocker: result.capability.blocker,
      enums: result.enums,
      checked_at: new Date().toISOString(),
    }),
  );
  return result;
}
export async function getView(ctx: Context): Promise<A2PView> {
  let r = await own(ctx);
  if (r?.agency_registration_id) {
    const agency = await import("./agency-a2p.server");
    if (!(await agency.member(ctx.userId)))
      return {
        registration: {
          ...r,
          suspended: true,
          blocker: "Agency legal-sender authorization is not active.",
        },
        business: emptyBusiness,
        campaign: emptyCampaign,
        enums: {
          entities: draftEntities,
          verticals: ["INSURANCE"],
          usecases: draftUsecases,
          exchanges: [],
        },
        capability: { ok: false, blocker: "Agency authorization is required." },
        numbers: [],
        links: [],
        operations: [],
        fees: null,
        otp: null,
      };
    const db = await admin();
    const owner = await checked<any>(
      await db
        .from("a2p_registrations")
        .select("*")
        .eq("id", r.agency_registration_id)
        .maybeSingle(),
    );
    if (owner)
      r = {
        ...r,
        brand_id: owner.brand_id,
        campaign_id: owner.campaign_id,
        brand_status: owner.brand_status,
        campaign_status: owner.campaign_status,
        suspended: r.suspended || owner.suspended,
      };
  }
  const cap = await capabilities();
  if (r?.brand_id && cap.capability.ok) {
    const db = await admin();
    const allowed = await checked(
      await db.rpc("a2p_take_rate_limit", { p_user: ctx.userId, p_action: "poll", p_seconds: 55 }),
    );
    if (allowed) {
      try {
        await synchronize(r);
        r = await own(ctx);
      } catch {
        /* preserve last verified state, SMS still rechecks */
      }
    }
  }
  const draft = r ? await privateDraft(r.id) : { business: emptyBusiness, campaign: emptyCampaign };
  // Identifiers remain server-side; the browser only receives a boolean marker.
  const business = {
    ...emptyBusiness,
    ...draft.business,
    ein: draft.business.ein ? "•••••••••" : "",
  };
  const db = await admin();
  const numbers = await checked<any[]>(
    await ctx.supabase.from("phone_numbers").select("phone_number").eq("user_id", ctx.userId),
  );
  const links = r
    ? await checked<any[]>(
        await ctx.supabase.from("a2p_number_links").select("*").eq("registration_id", r.id),
      )
    : [];
  const operations = r
    ? await checked<any[]>(
        await ctx.supabase
          .from("a2p_operations")
          .select("kind,state,detail,authorized_at,fee_snapshot")
          .eq("registration_id", r.id),
      )
    : [];
  let otp = null;
  if (r?.brand_id && draft.business.entityType === "SOLE_PROPRIETOR" && cap.capability.ok) {
    try {
      const v = await api(`/10dlc/brand/${encodeURIComponent(r.brand_id)}/smsOtp`);
      otp = { deliveryStatus: v.deliveryStatus ?? "Unknown", verified: !!v.verifyDate };
    } catch {
      /* brand status is authoritative */
    }
  }
  const saved = r
    ? await checked<any>(
        await db.from("a2p_private").select("ciphertext").eq("registration_id", r.id).maybeSingle(),
      )
    : null;
  const secret = saved ? await decrypt(saved.ciphertext) : null;
  return {
    registration: r,
    business,
    campaign: { ...emptyCampaign, ...draft.campaign },
    ...cap,
    numbers,
    links,
    operations,
    otp,
    fees: secret?.fees ?? null,
  };
}
async function audit(ctx: Context, id: string | null, event: string, detail?: string) {
  const db = await admin();
  await checked(
    await db
      .from("a2p_audit")
      .insert({ registration_id: id, actor_id: ctx.userId, event, detail: detail ?? null }),
  );
}
async function limit(ctx: Context, action: string, seconds: number) {
  const db = await admin();
  const ok = await checked(
    await db.rpc("a2p_take_rate_limit", {
      p_user: ctx.userId,
      p_action: action,
      p_seconds: seconds,
    }),
  );
  if (!ok) throw new Error("Please wait before repeating this operation.");
}
async function update(r: Registration, data: Record<string, unknown>) {
  const db = await admin();
  await checked(
    await db
      .from("a2p_registrations")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", r.id),
  );
}
function resource(v: any) {
  return v?.data ?? v;
}
export async function synchronize(r: Registration) {
  if (r.agency_registration_id) {
    const db = await admin();
    const owner = await checked<any>(
      await db
        .from("a2p_registrations")
        .select("*")
        .eq("id", r.agency_registration_id)
        .maybeSingle(),
    );
    if (!owner) throw new Error("Agency registration is unavailable.");
    r = { ...r, brand_id: owner.brand_id, campaign_id: owner.campaign_id };
  }
  const data: {
    synced_at: string;
    brand_status?: string;
    campaign_status?: string;
    blocker?: string | null;
  } = { synced_at: new Date().toISOString(), blocker: null };
  const reasons: string[] = [];
  if (r.brand_id) {
    const b = resource(await api(`/10dlc/brand/${encodeURIComponent(r.brand_id)}`));
    data.brand_status =
      b.status === "REGISTRATION_FAILED" ? b.status : (b.identityStatus ?? "UNVERIFIED");
    if (b.failureReasons) {
      reasons.push(JSON.stringify(b.failureReasons));
      data.blocker =
        "Telnyx reports brand verification issues. Review the legal entity details or request provider feedback.";
    }
  }
  if (r.campaign_id) {
    const c = resource(await api(`/10dlc/campaign/${encodeURIComponent(r.campaign_id)}`));
    data.campaign_status = c.campaignStatus ?? "TCR_PENDING";
    if (c.failureReasons) {
      reasons.push(JSON.stringify(c.failureReasons));
      data.blocker =
        "Telnyx reports campaign review issues. Review opt-in evidence, samples and disclosures. No automatic resubmission will occur.";
    }
  }
  // Provider feedback may contain identifiers: keep it encrypted and never log it.
  const draft = await privateDraft(r.id);
  const db = await admin();
  await checked(
    await db
      .from("a2p_private")
      .update({ ciphertext: await encrypt({ ...draft, providerFeedback: reasons }) })
      .eq("registration_id", r.id),
  );
  await update(r, data);
  const links = await checked<any[]>(
    await db.from("a2p_number_links").select("*").eq("registration_id", r.id),
  );
  for (const n of links) {
    try {
      const v = resource(
        await api(`/10dlc/phone_number_campaigns/${encodeURIComponent(n.phone_number)}`),
      );
      await checked(
        await db
          .from("a2p_number_links")
          .update({
            status: v.campaignId === r.campaign_id ? v.assignmentStatus : "CONFLICT",
            verified_at: new Date().toISOString(),
          })
          .eq("phone_number", n.phone_number),
      );
    } catch {
      await checked(
        await db
          .from("a2p_number_links")
          .update({ status: "UNKNOWN", verified_at: null })
          .eq("phone_number", n.phone_number),
      );
    }
  }
}
async function currentFees(r: Registration, draft: any, kind: "brand" | "campaign"): Promise<Fees> {
  const db = await admin();
  const f = await checked<any>(
    await db.from("a2p_fee_schedule").select("*").eq("id", "current").maybeSingle(),
  );
  if (!f || Date.now() - Date.parse(f.confirmed_at) > 30 * 86400000)
    throw new Error(
      "An admin must confirm current Telnyx brand and review charges first. Published Telnyx fees conflict; paid submission is blocked until confirmed.",
    );
  let monthly = 0,
    upfront = 0;
  if (kind === "campaign") {
    if (!r.brand_id || !brandVerified(r.brand_status))
      throw new Error("Brand identity verification must be complete first.");
    const q = resource(
      await api(
        `/10dlc/campaignBuilder/brand/${encodeURIComponent(r.brand_id)}/usecase/${encodeURIComponent(draft.campaign.usecase)}`,
      ),
    );
    if (Number(q.minSubUsecases ?? 0) > 0)
      throw new Error(
        "This use case requires sub-usecase selection, which is not yet supported. Choose a single use case or contact your administrator.",
      );
    const cost = resource(
      await api(
        `/10dlc/campaign/usecase/cost?usecase=${encodeURIComponent(draft.campaign.usecase)}`,
      ),
    );
    monthly = Number(cost.monthlyCost);
    upfront = Number(cost.upFrontCost);
    if (!Number.isFinite(monthly) || !Number.isFinite(upfront))
      throw new Error("Telnyx did not return complete campaign costs; submission is blocked.");
  }
  return {
    brand: Number(f.brand_fee),
    review: Number(f.campaign_review_fee),
    monthly,
    upfront,
    currency: f.currency,
    source: f.source,
    confirmed_at: f.confirmed_at,
    usecase: draft.campaign.usecase,
    quoted_at: new Date().toISOString(),
  };
}
export async function change(
  ctx: Context,
  action: A2pAction,
): Promise<{ ok: boolean; message: string }> {
  await authorized(ctx);
  await limit(ctx, action.action, action.action === "save" ? 2 : 10);
  const db = await admin();
  if (action.action === "fees") {
    await requireAdmin(ctx);
    await checked(
      await db.from("a2p_fee_schedule").upsert({
        id: "current",
        brand_fee: action.brand,
        campaign_review_fee: action.review,
        source: action.source,
        confirmed_by: ctx.userId,
        confirmed_at: new Date().toISOString(),
      }),
    );
    await audit(ctx, null, "fees_confirmed");
    return { ok: true, message: "Fee schedule confirmed. No charges were incurred." };
  }
  if (action.action === "suspend") {
    await requireAdmin(ctx);
    await checked(
      await db
        .from("a2p_registrations")
        .update({ suspended: action.suspended })
        .eq("id", action.id),
    );
    await audit(ctx, action.id, action.suspended ? "messaging_suspended" : "messaging_restored");
    return { ok: true, message: "Messaging restriction updated." };
  }
  let r = await own(ctx);
  if (action.action === "save") {
    const previous = r ? await privateDraft(r.id) : null;
    if (r?.campaign_id || r?.agency_registration_id)
      throw new Error(
        "Submitted campaign details are locked. Provider-approved correction workflows are required.",
      );
    let business = r?.brand_id
      ? previous.business
      : {
          ...action.business,
          ein:
            action.business.ein === "•••••••••"
              ? (previous?.business.ein ?? "")
              : action.business.ein,
        };
    if (business.relationship === "est8") {
      const agency = await import("./agency-a2p.server"),
        a = await agency.agency();
      business = (await import("./agency-a2p-rules")).inheritedBusiness(
        business,
        a.profile,
        await agency.member(ctx.userId),
      );
    }
    if (business.entityType === "SOLE_PROPRIETOR") business.ein = "";
    const saved = await checked<any>(
      await db
        .from("a2p_registrations")
        .upsert(
          {
            user_id: ctx.userId,
            relationship: business.relationship,
            display_name: business.displayName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )
        .select("*")
        .single(),
    );
    await checked(
      await db.from("a2p_private").upsert({
        registration_id: saved.id,
        ciphertext: await encrypt({ business, campaign: action.campaign }),
        updated_at: new Date().toISOString(),
      }),
    );
    await audit(ctx, saved.id, "draft_saved");
    return { ok: true, message: "Encrypted draft saved." };
  }
  if (!r) throw new Error("Save a draft first.");
  if (r.agency_registration_id && !["sync", "assign"].includes(action.action))
    throw new Error("Shared legal business registrations are managed by the agency administrator.");
  if (r.agency_registration_id && !(await (await import("./agency-a2p.server")).member(ctx.userId)))
    throw new Error("Agency legal-sender authorization has been revoked.");
  if (action.action === "sync") {
    await synchronize(r);
    await audit(ctx, r.id, "status_synced");
    return { ok: true, message: "Status retrieved from Telnyx." };
  }
  const draft = await privateDraft(r.id);
  if (action.action === "appeal") {
    await synchronize(r);
    const current = await own(ctx);
    if (
      !current?.campaign_id ||
      !["TELNYX_FAILED", "MNO_REJECTED"].includes(current.campaign_status)
    )
      throw new Error("Telnyx permits appeals only for TELNYX_FAILED or MNO_REJECTED campaigns.");
    const fees = await currentFees(current, draft, "campaign");
    if (
      draft.feeKind !== "campaign" ||
      !draft.fees ||
      Date.now() - Date.parse(draft.fees.quoted_at) > 15 * 60000 ||
      draft.fees.review !== fees.review ||
      draft.fees.confirmed_at !== fees.confirmed_at
    )
      throw new Error("Review current campaign fees before authorizing an appeal.");
    const lock = await db.from("a2p_operations").insert({
      registration_id: current.id,
      actor_id: ctx.userId,
      kind: "appeal",
      fee_snapshot: fees as any,
    });
    if (lock.error)
      throw new Error(
        "An appeal already started or could not be recorded. Reconciliation is required before another attempt.",
      );
    try {
      // Telnyx's documented campaign correction workflow permits sample edits, not legal-entity impersonation.
      await api(`/10dlc/campaign/${encodeURIComponent(current.campaign_id)}`, "PUT", {
        sample1: action.sample1,
        sample2: action.sample2,
      });
      await api(`/10dlc/campaign/${encodeURIComponent(current.campaign_id)}/appeal`, "POST", {
        appeal_reason: action.reason,
      });
      await checked(
        await db
          .from("a2p_private")
          .update({
            ciphertext: await encrypt({
              ...draft,
              campaign: { ...draft.campaign, sample1: action.sample1, sample2: action.sample2 },
              appealReason: action.reason,
            }),
          })
          .eq("registration_id", current.id),
      );
      await checked(
        await db
          .from("a2p_operations")
          .update({ state: "submitted", completed_at: new Date().toISOString() })
          .eq("registration_id", current.id)
          .eq("kind", "appeal"),
      );
      await audit(ctx, current.id, "campaign_appeal_authorized");
      await synchronize(current);
      return { ok: true, message: "Appeal sent for manual Telnyx review. No approval is assumed." };
    } catch (e) {
      await checked(
        await db
          .from("a2p_operations")
          .update({ state: "reconciliation_required", detail: safeMessage(e) })
          .eq("registration_id", current.id)
          .eq("kind", "appeal"),
      );
      throw e;
    }
  }
  if (action.action === "otpSend" || action.action === "otpVerify") {
    if (!r.brand_id || draft.business.entityType !== "SOLE_PROPRIETOR")
      throw new Error("OTP applies only to submitted sole-proprietor brands.");
    await api(
      `/10dlc/brand/${encodeURIComponent(r.brand_id)}/smsOtp`,
      action.action === "otpSend" ? "POST" : "PUT",
      action.action === "otpSend"
        ? {
            pinSms: "EST8 CallDesk verification PIN: @OTP_PIN@",
            successSms: "Business identity verification completed.",
          }
        : { otpPin: action.pin },
    );
    await audit(
      ctx,
      r.id,
      action.action === "otpSend" ? "otp_requested" : "otp_verification_attempted",
    );
    await synchronize(r);
    return {
      ok: true,
      message:
        action.action === "otpSend"
          ? "Verification code requested."
          : "Verification result refreshed.",
    };
  }
  if (action.action === "assign") {
    await synchronize(r);
    r = await own(ctx);
    if (r?.agency_registration_id) {
      const owner = await checked<any>(
        await db
          .from("a2p_registrations")
          .select("*")
          .eq("id", r.agency_registration_id)
          .maybeSingle(),
      );
      if (owner)
        r = {
          ...r,
          brand_id: owner.brand_id,
          campaign_id: owner.campaign_id,
          brand_status: owner.brand_status,
          campaign_status: owner.campaign_status,
          suspended: r.suspended || owner.suspended,
        };
    }
    if (
      !r?.campaign_id ||
      !brandVerified(r.brand_status) ||
      !campaignApproved(r.campaign_status) ||
      r.suspended
    )
      throw new Error("A verified brand and carrier-provisioned campaign are required.");
    const n = await checked<any>(
      await ctx.supabase
        .from("phone_numbers")
        .select("phone_number")
        .eq("user_id", ctx.userId)
        .eq("phone_number", action.phone)
        .maybeSingle(),
    );
    if (!n) throw new Error("This number does not belong to your account.");
    if (draft.business.entityType === "SOLE_PROPRIETOR") {
      const { count } = await db
        .from("a2p_number_links")
        .select("*", { count: "exact", head: true })
        .eq("registration_id", r.id)
        .neq("phone_number", action.phone);
      if (count) throw new Error("Sole-proprietor campaigns support one phone number.");
    }
    let existing = null;
    try {
      existing = resource(
        await api(`/10dlc/phone_number_campaigns/${encodeURIComponent(action.phone)}`),
      );
    } catch (e) {
      if (!(e instanceof TelnyxError) || e.status !== 404) throw e;
    }
    if (existing?.campaignId && existing.campaignId !== r.campaign_id)
      throw new Error("This number already belongs to another campaign; no reassignment was made.");
    await checked(
      await db.from("a2p_number_links").upsert(
        {
          phone_number: action.phone,
          registration_id: r.id,
          user_id: ctx.userId,
          campaign_id: r.campaign_id,
          status: "PENDING_ASSIGNMENT",
          verified_at: null,
        },
        { onConflict: "phone_number", ignoreDuplicates: true },
      ),
    );
    if (!existing)
      await api("/10dlc/phone_number_campaigns", "POST", {
        phoneNumber: action.phone,
        campaignId: r.campaign_id,
      });
    await synchronize(r);
    await audit(ctx, r.id, "number_association_requested");
    return { ok: true, message: "Number association requested; actual carrier status retrieved." };
  }
  const cap = await capabilities();
  if (!cap.capability.ok) {
    await update(r, { blocker: cap.capability.blocker });
    throw new Error(cap.capability.blocker ?? "10DLC access is unavailable.");
  }
  const errors =
    action.kind === "brand"
      ? businessErrors(draft.business, cap.enums.entities, cap.enums.verticals)
      : campaignErrors(draft.campaign, cap.enums.usecases);
  if (draft.business.relationship === "est8") {
    const agency = await import("./agency-a2p.server"),
      a = await agency.agency();
    if (!(await agency.member(ctx.userId)) || !a.profile.verified)
      throw new Error("Verified legal-sender authorization is required.");
    if (a.profile.registrationOwner !== ctx.userId)
      throw new Error(
        "Only the designated agency legal representative can create a new agency brand or campaign. Agents must reuse the approved agency registration.",
      );
    if (a.profile.brandId || a.profile.campaignId) {
      if (!r.brand_id)
        throw new Error(
          "An existing agency registration is on file. Verify and reuse it instead of creating a paid duplicate.",
        );
    }
  }
  if (draft.business.country !== "US")
    errors.push(
      "This registration workflow currently supports US legal businesses only. Other jurisdictions require additional identifier support.",
    );
  if (errors.length) throw new Error(errors.join(" "));
  if (action.kind === "campaign") {
    const a = await import("./agency-a2p.server");
    if (draft.business.relationship === "est8" && !(await a.formVerified()))
      throw new Error(
        "The agency's actual public opt-in process must be published, functioning and verified first.",
      );
    if (draft.business.relationship !== "est8")
      throw new Error(
        "Independent businesses must have their own public consent process verified by an administrator before campaign submission; automated external-form verification is not available yet.",
      );
  }
  if (
    action.kind === "campaign" &&
    draft.business.entityType === "SOLE_PROPRIETOR" &&
    draft.campaign.usecase !== "SOLE_PROPRIETOR"
  )
    throw new Error("Sole proprietors must use the SOLE_PROPRIETOR campaign category.");
  const fees = await currentFees(r, draft, action.kind);
  if (action.action === "review") {
    await checked(
      await db
        .from("a2p_private")
        .update({ ciphertext: await encrypt({ ...draft, fees, feeKind: action.kind }) })
        .eq("registration_id", r.id),
    );
    await update(r, { stage: "ready", blocker: null });
    return {
      ok: true,
      message: "Eligibility and fees checked. Review and authorize before submission.",
    };
  }
  if (r.suspended) throw new Error("Messaging is suspended; contact your administrator.");
  if (
    draft.feeKind !== action.kind ||
    !draft.fees ||
    Date.now() - Date.parse(draft.fees.quoted_at) > 15 * 60000 ||
    ["brand", "review", "monthly", "upfront", "confirmed_at", "usecase"].some(
      (k) => draft.fees[k] !== (fees as any)[k],
    )
  )
    throw new Error("Fees changed or the quote expired. Review fees again before authorizing.");
  if ((action.kind === "brand" && r.brand_id) || (action.kind === "campaign" && r.campaign_id))
    throw new Error("A registration already exists; no duplicate submission was made.");
  if (action.kind === "brand") {
    // Search every page before creating; never attach a shared legal entity automatically.
    for (let page = 1; ; page++) {
      const list = await api(`/10dlc/brand?recordsPerPage=500&page=${page}`);
      const records = list.records ?? [];
      if (
        records.some(
          (b: any) =>
            (draft.business.ein &&
              b.ein?.replace(/-/g, "") === draft.business.ein.replace(/-/g, "")) ||
            (b.companyName?.toLowerCase() === draft.business.companyName.toLowerCase() &&
              !!draft.business.companyName),
        )
      )
        throw new Error(
          "A matching legal business is already registered. Ask your administrator to verify ownership; no duplicate paid brand was created.",
        );
      if (page * 500 >= Number(list.totalRecords ?? records.length) || records.length < 500) break;
    }
  }
  const registration = r;
  const kind = action.kind;
  await onceOnly(
    async () => {
      const result = await db.from("a2p_operations").insert({
        registration_id: registration.id,
        actor_id: ctx.userId,
        kind,
        fee_snapshot: fees as any,
      });
      if (result.error?.code === "23505") return false;
      if (result.error) throw new Error("Authorization could not be recorded; no submission made.");
      return true;
    },
    async () => {
      await audit(ctx, registration.id, `${kind}_submission_authorized`);
      try {
        let body: any;
        if (kind === "brand") {
          const { relationship, legalAuthority, ...b } = draft.business;
          body = Object.fromEntries(Object.entries(b).filter(([, v]) => v !== ""));
          if (body.entityType === "SOLE_PROPRIETOR") delete body.ein;
          if (body.entityType !== "PUBLIC_PROFIT") delete body.businessContactEmail;
        } else {
          const { optinUrl, marketing, consentConfirmed, ...c } = draft.campaign;
          body = {
            ...c,
            messageFlow: `${c.messageFlow}\nOpt-in evidence: ${optinUrl}`,
            brandId: registration.brand_id,
            referenceId: registration.id,
          };
        }
        body.webhookURL = `${APP}/api/public/telephony/a2p-events`;
        const response = resource(
          await api(kind === "brand" ? "/10dlc/brand" : "/10dlc/campaignBuilder", "POST", body),
        );
        const id = kind === "brand" ? response.brandId : response.campaignId;
        if (!id)
          throw new Error(
            "Telnyx did not return a registration identifier. Reconciliation is required; do not submit again.",
          );
        await update(
          registration,
          kind === "brand"
            ? {
                brand_id: id,
                brand_status: response.identityStatus ?? "UNVERIFIED",
                stage: "submitted",
                submitted_at: new Date().toISOString(),
              }
            : {
                campaign_id: id,
                campaign_status: response.campaignStatus ?? "TCR_PENDING",
                stage: "submitted",
                submitted_at: new Date().toISOString(),
              },
        );
        await checked(
          await db
            .from("a2p_operations")
            .update({ state: "submitted", provider_id: id, completed_at: new Date().toISOString() })
            .eq("registration_id", registration.id)
            .eq("kind", kind),
        );
        await audit(ctx, registration.id, `${kind}_submitted`);
      } catch (e) {
        const message = safeMessage(e);
        await update(registration, { stage: "uncertain", blocker: message });
        await checked(
          await db
            .from("a2p_operations")
            .update({ state: "reconciliation_required", detail: message })
            .eq("registration_id", registration.id)
            .eq("kind", kind),
        );
        throw e;
      }
    },
  );
  return { ok: true, message: "Submitted to Telnyx for review—not carrier approval." };
}
export async function adminView(ctx: Context) {
  await requireAdmin(ctx);
  const registrations = await checked<any[]>(
    await ctx.supabase
      .from("a2p_registrations")
      .select("*")
      .order("updated_at", { ascending: false }),
  );
  const operations = await checked<any[]>(
    await ctx.supabase
      .from("a2p_operations")
      .select("registration_id,kind,state,detail,fee_snapshot,authorized_at"),
  );
  const links = await checked<any[]>(await ctx.supabase.from("a2p_number_links").select("*"));
  const fees = await checked<any>(
    await ctx.supabase.from("a2p_fee_schedule").select("*").eq("id", "current").maybeSingle(),
  );
  return { registrations: registrations as Registration[], operations, links, fees };
}
export async function verifySmsCompliance(userId: string, phone: string | null) {
  if (!phone) return false;
  const db = await admin();
  let r = await checked<any>(
    await db.from("a2p_registrations").select("*").eq("user_id", userId).maybeSingle(),
  );
  if (r?.agency_registration_id) {
    if (!(await (await import("./agency-a2p.server")).member(userId))) return false;
    const owner = await checked<any>(
      await db
        .from("a2p_registrations")
        .select("*")
        .eq("id", r.agency_registration_id)
        .maybeSingle(),
    );
    if (!owner || owner.suspended) return false;
    r = {
      ...r,
      brand_id: owner.brand_id,
      campaign_id: owner.campaign_id,
      brand_status: owner.brand_status,
      campaign_status: owner.campaign_status,
    };
  }
  if (!r || r.suspended || !r.brand_id || !r.campaign_id) return false;
  await synchronize(r);
  r = await checked<any>(
    await db.from("a2p_registrations").select("*").eq("user_id", userId).maybeSingle(),
  );
  if (r?.agency_registration_id) {
    const owner = await checked<any>(
      await db
        .from("a2p_registrations")
        .select("*")
        .eq("id", r.agency_registration_id)
        .maybeSingle(),
    );
    if (!owner || owner.suspended) return false;
    r = { ...r, brand_id: owner.brand_id, campaign_id: owner.campaign_id };
  }
  const link = await checked<any>(
    await db
      .from("a2p_number_links")
      .select("*")
      .eq("user_id", userId)
      .eq("phone_number", phone)
      .maybeSingle(),
  );
  return smsReady(r, link);
}
