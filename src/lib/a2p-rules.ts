import { z } from "zod";

const text = (max = 100) => z.string().trim().max(max);
const url = text(500).refine(
  (v) => !v || /^https:\/\/[^\s]+$/.test(v),
  "Use a public HTTPS address.",
);
// Verified Telnyx OpenAPI values for offline drafts only; live values govern submission.
export const draftEntities = [
  "PRIVATE_PROFIT",
  "PUBLIC_PROFIT",
  "NON_PROFIT",
  "GOVERNMENT",
  "SOLE_PROPRIETOR",
];
export const draftUsecases = [
  "CUSTOMER_CARE",
  "ACCOUNT_NOTIFICATION",
  "MARKETING",
  "SOLE_PROPRIETOR",
];
export const businessSchema = z.object({
  relationship: z.enum(["est8", "independent"]),
  entityType: text(),
  displayName: text(),
  companyName: text(),
  firstName: text(),
  lastName: text(),
  ein: text(20),
  phone: text(20),
  mobilePhone: text(20),
  email: text(),
  businessContactEmail: text(),
  website: url,
  street: text(),
  city: text(),
  state: text(20),
  postalCode: text(10),
  country: text(2),
  vertical: text(),
  stockSymbol: text(10),
  stockExchange: text(30),
  isReseller: z.boolean(),
  legalAuthority: z.boolean(),
});
export const campaignSchema = z.object({
  usecase: text(80),
  description: text(4096),
  messageFlow: text(4096),
  optinUrl: url,
  privacyPolicyLink: url,
  termsAndConditionsLink: url,
  sample1: text(1024),
  sample2: text(1024),
  sample3: text(1024),
  sample4: text(1024),
  sample5: text(1024),
  optinKeywords: text(100),
  optoutKeywords: text(100),
  helpKeywords: text(100),
  optinMessage: text(1024),
  optoutMessage: text(1024),
  helpMessage: text(1024),
  embeddedLink: z.boolean(),
  embeddedPhone: z.boolean(),
  embeddedLinkSample: url,
  ageGated: z.boolean(),
  directLending: z.boolean(),
  numberPool: z.boolean(),
  subscriberOptin: z.boolean(),
  subscriberOptout: z.boolean(),
  subscriberHelp: z.boolean(),
  termsAndConditions: z.boolean(),
  autoRenewal: z.boolean(),
  marketing: z.boolean(),
  resellerId: text(100),
  consentConfirmed: z.boolean(),
});
export type Business = z.infer<typeof businessSchema>;
export type Campaign = z.infer<typeof campaignSchema>;
export const emptyBusiness: Business = {
  relationship: "independent",
  entityType: "PRIVATE_PROFIT",
  displayName: "",
  companyName: "",
  firstName: "",
  lastName: "",
  ein: "",
  phone: "",
  mobilePhone: "",
  email: "",
  businessContactEmail: "",
  website: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
  vertical: "INSURANCE",
  stockSymbol: "",
  stockExchange: "",
  isReseller: false,
  legalAuthority: false,
};
export const emptyCampaign: Campaign = {
  usecase: "",
  description: "",
  messageFlow: "",
  optinUrl: "",
  privacyPolicyLink: "",
  termsAndConditionsLink: "",
  sample1: "",
  sample2: "",
  sample3: "",
  sample4: "",
  sample5: "",
  optinKeywords: "",
  optoutKeywords: "STOP",
  helpKeywords: "HELP",
  optinMessage: "",
  optoutMessage: "",
  helpMessage: "",
  embeddedLink: false,
  embeddedPhone: false,
  embeddedLinkSample: "",
  ageGated: false,
  directLending: false,
  numberPool: false,
  subscriberOptin: false,
  subscriberOptout: false,
  subscriberHelp: false,
  termsAndConditions: false,
  autoRenewal: false,
  marketing: false,
  resellerId: "",
  consentConfirmed: false,
};

export function businessErrors(b: Business, entities: string[], verticals: string[]) {
  const errors: string[] = [];
  if (!entities.includes(b.entityType))
    errors.push("Choose an entity type currently supported by Telnyx.");
  if (!verticals.includes(b.vertical)) errors.push("Choose a supported industry.");
  for (const k of [
    "displayName",
    "firstName",
    "lastName",
    "street",
    "city",
    "country",
    "state",
    "postalCode",
    "website",
  ] as const)
    if (!b[k]) errors.push(`${k} is required.`);
  if (!z.string().email().safeParse(b.email).success)
    errors.push("Enter a valid representative email.");
  if (!/^\+[1-9]\d{7,14}$/.test(b.phone))
    errors.push("Enter the representative phone in international format (+1…).");
  if (b.entityType !== "SOLE_PROPRIETOR" && !b.companyName)
    errors.push("Legal business name is required.");
  if (
    b.country === "US" &&
    b.entityType !== "SOLE_PROPRIETOR" &&
    !/^\d{9}$/.test(b.ein.replace(/-/g, ""))
  )
    errors.push("Enter the legal business's nine-digit EIN, not an SSN.");
  if (b.country === "US" && (!/^[A-Z]{2}$/.test(b.state) || !/^\d{5}$/.test(b.postalCode)))
    errors.push("US businesses need a two-letter state and five-digit ZIP.");
  if (b.entityType === "SOLE_PROPRIETOR" && !/^\+[1-9]\d{7,14}$/.test(b.mobilePhone))
    errors.push("Sole proprietors need a mobile number for verification.");
  if (
    b.entityType === "PUBLIC_PROFIT" &&
    (!b.stockSymbol ||
      !b.stockExchange ||
      !z.string().email().safeParse(b.businessContactEmail).success)
  )
    errors.push("Public companies need stock details and a business contact email.");
  if (!b.legalAuthority)
    errors.push("Confirm your authority to represent this actual legal entity.");
  return errors;
}
export function campaignErrors(c: Campaign, usecases: string[]) {
  const errors: string[] = [];
  if (!usecases.includes(c.usecase)) errors.push("Choose a Telnyx-supported campaign use case.");
  for (const k of [
    "description",
    "messageFlow",
    "optinUrl",
    "privacyPolicyLink",
    "termsAndConditionsLink",
    "sample1",
    "sample2",
    "optinMessage",
    "optoutMessage",
    "helpMessage",
    "optoutKeywords",
    "helpKeywords",
  ] as const)
    if (!c[k]) errors.push(`${k} is required.`);
  if (
    !c.consentConfirmed ||
    !c.subscriberOptin ||
    !c.subscriberOptout ||
    !c.subscriberHelp ||
    !c.termsAndConditions
  )
    errors.push("Confirm actual opt-in evidence, opt-out/help support and terms acceptance.");
  if (c.embeddedLink && !c.embeddedLinkSample) errors.push("Provide a sample embedded link.");
  return errors;
}
export function brandVerified(status: string) {
  return ["VERIFIED", "VETTED_VERIFIED"].includes(status.toUpperCase());
}
export function campaignApproved(status: string) {
  return status.toUpperCase() === "MNO_PROVISIONED";
}
export function smsReady(
  r: { brand_status: string; campaign_status: string; suspended: boolean } | null,
  link: { status: string; verified_at?: string | null } | null,
  now = Date.now(),
) {
  return (
    !!r &&
    !r.suspended &&
    brandVerified(r.brand_status) &&
    campaignApproved(r.campaign_status) &&
    link?.status === "ASSIGNED" &&
    !!link.verified_at &&
    now - Date.parse(link.verified_at) < 300_000
  );
}
export function stageLabel(
  r: { stage: string; brand_status: string; campaign_status: string; suspended: boolean } | null,
  ready = false,
) {
  if (!r) return "Not Started";
  if (r.suspended) return "Action Required";
  if (ready) return "SMS Ready";
  if (/REJECT|FAILED/.test(r.brand_status + r.campaign_status)) return "Rejected";
  if (/SUSPENDED|EXPIRED/.test(r.campaign_status)) return "Action Required";
  if (r.stage === "uncertain" || r.stage === "action_required") return "Action Required";
  if (campaignApproved(r.campaign_status)) return "Approved";
  if (r.campaign_status) return "Campaign Under Review";
  if (brandVerified(r.brand_status)) return "Brand Verified";
  if (/PENDING|UNVERIFIED/.test(r.brand_status)) return "Identity Verification Pending";
  if (r.stage === "submitted") return "Submitted to Telnyx";
  if (r.stage === "ready") return "Ready for Submission";
  return "Draft Saved";
}
export async function onceOnly<T>(
  claim: () => Promise<boolean>,
  send: () => Promise<T>,
): Promise<T> {
  if (!(await claim()))
    throw new Error("Submission already started; reconcile its status before retrying.");
  return send();
}
