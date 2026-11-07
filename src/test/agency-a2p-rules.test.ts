import { describe, it, expect } from "vitest";
import {
  defaultAgency,
  preparedCampaign,
  optinDescription,
  canInherit,
  inheritedBusiness,
  keywordAction,
  consentAllows,
  INSURANCE_SAMPLES,
} from "@/lib/agency-a2p-rules";
import { emptyBusiness } from "@/lib/a2p-rules";
describe("Phase 6B legal sender and consent rules", () => {
  it("requires per-agent authorization to inherit agency identity", () =>
    expect(canInherit("est8", false, true)).toBe(false));
  it("requires verified agency profile", () => expect(canInherit("est8", true, false)).toBe(false));
  it("independent agents never inherit agency business", () =>
    expect(
      inheritedBusiness(
        { ...emptyBusiness, companyName: "Independent" },
        { ...defaultAgency, verified: true },
        true,
      ).companyName,
    ).toBe("Independent"));
  it("protected legal fields come from agency, not agent input", () =>
    expect(
      inheritedBusiness(
        { ...emptyBusiness, relationship: "est8", companyName: "Tampered" },
        {
          ...defaultAgency,
          verified: true,
          business: { ...defaultAgency.business, companyName: "Verified EST8" },
        },
        true,
      ).companyName,
    ).toBe("Verified EST8"));
  it("blocks unauthorized legal inheritance", () =>
    expect(() =>
      inheritedBusiness(
        { ...emptyBusiness, relationship: "est8" },
        { ...defaultAgency, verified: true },
        false,
      ),
    ).toThrow("authorize"));
  it("does not claim an unverified consent process exists", () =>
    expect(optinDescription("https://example.com", false)).toBe(""));
  it("verified opt-in description identifies the actual URL", () =>
    expect(optinDescription("https://example.com/actual", true)).toContain(
      "https://example.com/actual",
    ));
  it("populates four nonpromotional samples", () =>
    expect(preparedCampaign(defaultAgency, false).sample1).toBe(INSURANCE_SAMPLES[0]));
  it("omits promotional sample without verified marketing consent", () =>
    expect(
      preparedCampaign(
        { ...defaultAgency, campaign: { ...defaultAgency.campaign, marketing: true } },
        true,
      ).sample5,
    ).toBe(""));
  it("includes promotional sample only for verified marketing program", () =>
    expect(
      preparedCampaign(
        {
          ...defaultAgency,
          marketingConsentVerified: true,
          campaign: { ...defaultAgency.campaign, marketing: true },
        },
        true,
      ).sample5,
    ).toBe(INSURANCE_SAMPLES[4]));
  it("legal attestations remain unchecked", () =>
    expect(preparedCampaign(defaultAgency, true).termsAndConditions).toBe(false));
  it("recurring fee authorization remains unchecked", () =>
    expect(preparedCampaign(defaultAgency, true).autoRenewal).toBe(false));
  it("agent consent evidence attestation remains unchecked", () =>
    expect(preparedCampaign(defaultAgency, true).consentConfirmed).toBe(false));
  it("verified support fills HELP response", () =>
    expect(
      preparedCampaign({ ...defaultAgency, supportEmail: "support@example.com" }, true).helpMessage,
    ).toContain("support@example.com"));
  it("START default is factual, not consent evidence", () =>
    expect(preparedCampaign(defaultAgency, false).optinKeywords).toBe("START"));
  it("recognizes STOP", () => expect(keywordAction(" stop ")).toBe("stop"));
  it("recognizes START", () => expect(keywordAction("START")).toBe("start"));
  it("recognizes HELP without changing consent", () => expect(keywordAction("HELP")).toBe("help"));
  it("suppression overrides marketing consent", () =>
    expect(consentAllows(true, true, true, true)).toBe(false));
  it("transactional consent is not marketing consent", () =>
    expect(consentAllows(true, false, true, false)).toBe(false));
  it("no invented consent for purchased leads", () =>
    expect(consentAllows(false, false, false, false)).toBe(false));
});
