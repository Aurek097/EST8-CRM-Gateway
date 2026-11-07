import { z } from "zod";
import {
  businessSchema,
  campaignSchema,
  emptyBusiness,
  emptyCampaign,
  type Business,
  type Campaign,
} from "./a2p-rules";

export const INSURANCE_DESCRIPTION =
  "EST8 Financial Group uses permission-based SMS communications to respond to consumer inquiries about life insurance products and services, including term life, whole life, final expense, mortgage protection, and other coverage options.\n\nAuthorized representatives communicate with consumers who have requested insurance information or provided the appropriate SMS consent.\n\nMessages may include responses to insurance inquiries, requested coverage follow-ups, appointment scheduling, confirmations, reminders, and customer service communications.\n\nPromotional insurance messages are sent only to recipients who have provided the required marketing consent.\n\nMessage frequency varies. Message and data rates may apply. Consumers can reply STOP to unsubscribe or HELP for assistance. Consent to promotional messages is not required to purchase insurance.";
export const INSURANCE_SAMPLES = [
  "EST8 Financial Group: Thanks for requesting life insurance information. What time works best to discuss your options? Reply STOP to opt out.",
  "EST8 Financial Group: Your insurance consultation is scheduled for [DATE] at [TIME]. Reply CONFIRM or RESCHEDULE. Reply STOP to opt out.",
  "EST8 Financial Group: Hi [FIRST NAME], following up on the insurance information you requested. Would you like to discuss your coverage options? Reply STOP to opt out.",
  "EST8 Financial Group: Reminder of your insurance appointment on [DATE] at [TIME]. We look forward to speaking with you. Reply STOP to opt out.",
  "EST8 Financial Group: Interested in reviewing life insurance options for your family's financial protection? Reply INFO to speak with an agent. Reply STOP to opt out.",
];
export const START_RESPONSE =
  "EST8 Financial Group: You are subscribed to insurance-related text updates. Message frequency varies. Msg & data rates may apply. Reply HELP for help or STOP to unsubscribe.";
export const STOP_RESPONSE =
  "EST8 Financial Group: You have been unsubscribed and will no longer receive text messages.";
export const DISCLOSURE_VERSION = "2026-11-v1";
export const PUBLIC_OPTIN_URL = "https://est8-symmetry-gateway.lovable.app/sms-consent";
export function consentDisclosure(
  sender: string,
  privacy: string,
  terms: string,
  marketing = false,
) {
  return `I agree to receive ${marketing ? "promotional insurance" : "insurance inquiry, follow-up, appointment and customer service"} text messages from ${sender}. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for assistance. ${marketing ? "Consent to marketing texts" : "SMS consent"} is optional and is not required to purchase insurance or submit an inquiry. Privacy Policy: ${privacy}. Terms of Service: ${terms}.`;
}
export function optinDescription(url: string, verified: boolean) {
  if (!verified) return "";
  return `Consumers voluntarily opt into EST8 Financial Group SMS communications through an insurance inquiry form located at ${url}.\n\nThe form includes an optional, unchecked SMS consent checkbox, which consumers must actively select.\n\nThe consent disclosure identifies EST8 Financial Group, the types of messages consumers may receive, variable message frequency, applicable message and data rates, STOP and HELP instructions, and links to the Privacy Policy and Terms of Service.\n\nConsent to marketing text messages is not required to purchase insurance or submit an inquiry.\n\nThe platform records each consumer's affirmative opt-in choice, timestamp, form source, and consent disclosure version.\n\nConsumers can unsubscribe by replying STOP at any time.`;
}
export const agencySchema = z.object({
  business: businessSchema,
  campaign: campaignSchema,
  supportEmail: z.string().trim().max(100),
  supportPhone: z.string().trim().max(20),
  brandId: z.string().max(100),
  campaignId: z.string().max(100),
  registrationOwner: z.string().uuid().or(z.literal("")),
  marketingConsentVerified: z.boolean(),
  verified: z.boolean(),
  verificationReference: z.string().trim().max(1000),
});
export type AgencyProfile = z.infer<typeof agencySchema>;
export const defaultAgency: AgencyProfile = {
  business: { ...emptyBusiness, relationship: "est8", displayName: "EST8 Financial Group" },
  campaign: {
    ...emptyCampaign,
    description: INSURANCE_DESCRIPTION,
    sample1: INSURANCE_SAMPLES[0] ?? "",
    sample2: INSURANCE_SAMPLES[1] ?? "",
    sample3: INSURANCE_SAMPLES[2] ?? "",
    sample4: INSURANCE_SAMPLES[3] ?? "",
    optinKeywords: "START",
    optinMessage: START_RESPONSE,
    optoutMessage: STOP_RESPONSE,
    optinUrl: PUBLIC_OPTIN_URL,
  },
  supportEmail: "",
  supportPhone: "",
  brandId: "",
  campaignId: "",
  registrationOwner: "",
  marketingConsentVerified: false,
  verified: false,
  verificationReference: "",
};
export function preparedCampaign(a: AgencyProfile, liveFormVerified: boolean): Campaign {
  const marketing = a.campaign.marketing && a.marketingConsentVerified;
  return {
    ...a.campaign,
    sample5: marketing ? a.campaign.sample5 || INSURANCE_SAMPLES[4] || "" : "",
    marketing,
    messageFlow: liveFormVerified ? optinDescription(a.campaign.optinUrl, true) : "",
    subscriberOptin: liveFormVerified,
    helpMessage:
      a.supportEmail || a.supportPhone
        ? `EST8 Financial Group: For assistance, contact ${[a.supportEmail, a.supportPhone].filter(Boolean).join(" or ")}. Reply STOP to unsubscribe.`
        : "",
    subscriberOptout: true,
    subscriberHelp: true,
    termsAndConditions: false,
    autoRenewal: false,
    consentConfirmed: false,
  };
}
export function canInherit(
  relationship: string,
  memberAuthorized: boolean,
  profileVerified: boolean,
) {
  return relationship === "est8" && memberAuthorized && profileVerified;
}
export function inheritedBusiness(input: Business, a: AgencyProfile, memberAuthorized: boolean) {
  if (input.relationship !== "est8") return input;
  if (!canInherit(input.relationship, memberAuthorized, a.verified))
    throw new Error(
      "Your administrator must authorize you for EST8’s verified legal sender first.",
    );
  return { ...a.business, relationship: "est8" as const, legalAuthority: input.legalAuthority };
}
export function keywordAction(text: string): "stop" | "start" | "help" | null {
  const value = text.trim().toUpperCase();
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(value)) return "stop";
  if (["START", "UNSTOP"].includes(value)) return "start";
  return value === "HELP" || value === "INFO" ? "help" : null;
}
export function consentAllows(
  transactional: boolean,
  marketing: boolean,
  promotional: boolean,
  suppressed: boolean,
) {
  return !suppressed && (promotional ? marketing : transactional);
}
