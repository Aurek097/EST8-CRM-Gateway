import { describe, it, expect, vi } from "vitest";
import {
  emptyBusiness,
  emptyCampaign,
  businessErrors,
  campaignErrors,
  campaignApproved,
  smsReady,
  stageLabel,
  onceOnly,
} from "@/lib/a2p-rules";

const business = {
  ...emptyBusiness,
  displayName: "Mock Agency",
  companyName: "Mock Agency LLC",
  firstName: "Test",
  lastName: "Person",
  street: "123 Test St",
  city: "Houston",
  state: "TX",
  postalCode: "77001",
  website: "https://example.com",
  email: "test@example.com",
  phone: "+12815550100",
  ein: "123456789",
  legalAuthority: true,
};
describe("A2P registration safeguards", () => {
  it("accepts complete incorporated business fields", () =>
    expect(businessErrors(business, ["PRIVATE_PROFIT"], ["INSURANCE"])).toEqual([]));
  it("requires EIN for US incorporated businesses", () =>
    expect(businessErrors({ ...business, ein: "" }, ["PRIVATE_PROFIT"], ["INSURANCE"])).toContain(
      "Enter the legal business's nine-digit EIN, not an SSN.",
    ));
  it("does not require EIN for sole proprietors", () =>
    expect(
      businessErrors(
        { ...business, entityType: "SOLE_PROPRIETOR", ein: "", mobilePhone: "+12815550100" },
        ["SOLE_PROPRIETOR"],
        ["INSURANCE"],
      ),
    ).toEqual([]));
  it("requires sole proprietor OTP mobile", () =>
    expect(
      businessErrors(
        { ...business, entityType: "SOLE_PROPRIETOR" },
        ["SOLE_PROPRIETOR"],
        ["INSURANCE"],
      ),
    ).toContain("Sole proprietors need a mobile number for verification."));
  it("requires legal authority regardless of downline relationship", () =>
    expect(
      businessErrors(
        { ...business, relationship: "est8", legalAuthority: false },
        ["PRIVATE_PROFIT"],
        ["INSURANCE"],
      ),
    ).toContain("Confirm your authority to represent this actual legal entity."));
  it("rejects an entity not supported by provider schema", () =>
    expect(businessErrors(business, ["SOLE_PROPRIETOR"], ["INSURANCE"])).toContain(
      "Choose an entity type currently supported by Telnyx.",
    ));
  it("does not invent purchased lead consent", () =>
    expect(campaignErrors(emptyCampaign, ["MARKETING"])).toContain(
      "Confirm actual opt-in evidence, opt-out/help support and terms acceptance.",
    ));
  it("requires public opt-in evidence", () =>
    expect(campaignErrors({ ...emptyCampaign, usecase: "MARKETING" }, ["MARKETING"])).toContain(
      "optinUrl is required.",
    ));
  it("does not treat an ACTIVE campaign as carrier approved", () =>
    expect(campaignApproved("ACTIVE")).toBe(false));
  it("does not treat Telnyx acceptance as carrier provisioning", () =>
    expect(campaignApproved("TELNYX_ACCEPTED")).toBe(false));
  it("requires carrier provisioning for approval", () =>
    expect(campaignApproved("MNO_PROVISIONED")).toBe(true));
  it("blocks unapproved business SMS", () =>
    expect(
      smsReady(
        { brand_status: "VERIFIED", campaign_status: "MNO_PENDING", suspended: false },
        { status: "ASSIGNED", verified_at: new Date().toISOString() },
      ),
    ).toBe(false));
  it("blocks numbers not actually associated", () =>
    expect(
      smsReady(
        { brand_status: "VERIFIED", campaign_status: "MNO_PROVISIONED", suspended: false },
        { status: "PENDING_ASSIGNMENT", verified_at: new Date().toISOString() },
      ),
    ).toBe(false));
  it("allows verified carrier-provisioned associated SMS", () =>
    expect(
      smsReady(
        { brand_status: "VERIFIED", campaign_status: "MNO_PROVISIONED", suspended: false },
        { status: "ASSIGNED", verified_at: new Date().toISOString() },
      ),
    ).toBe(true));
  it("blocks administrator-suspended messaging", () =>
    expect(
      smsReady(
        { brand_status: "VERIFIED", campaign_status: "MNO_PROVISIONED", suspended: true },
        { status: "ASSIGNED", verified_at: new Date().toISOString() },
      ),
    ).toBe(false));
  it("fails closed on stale provider checks", () =>
    expect(
      smsReady(
        { brand_status: "VERIFIED", campaign_status: "MNO_PROVISIONED", suspended: false },
        { status: "ASSIGNED", verified_at: "2020-01-01T00:00:00Z" },
      ),
    ).toBe(false));
  it("reports rejection without automatic approval", () =>
    expect(
      stageLabel({
        stage: "submitted",
        brand_status: "VERIFIED",
        campaign_status: "MNO_REJECTED",
        suspended: false,
      }),
    ).toBe("Rejected"));
  it("holds ambiguous submissions for reconciliation", () =>
    expect(
      stageLabel({ stage: "uncertain", brand_status: "", campaign_status: "", suspended: false }),
    ).toBe("Action Required"));
  it("simulates submission once and blocks paid duplicate retries", async () => {
    let claimed = false;
    const claim = async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    };
    const send = vi.fn(async () => ({ brandId: "mock-id", identityStatus: "UNVERIFIED" }));
    expect(await onceOnly(claim, send)).toEqual({
      brandId: "mock-id",
      identityStatus: "UNVERIFIED",
    });
    await expect(onceOnly(claim, send)).rejects.toThrow("Submission already started");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("does not auto-retry rejected submissions", async () => {
    let claimed = false;
    const claim = async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    };
    const send = vi.fn(async () => {
      throw new Error("rejected");
    });
    await expect(onceOnly(claim, send)).rejects.toThrow("rejected");
    await expect(onceOnly(claim, send)).rejects.toThrow("Submission already started");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
