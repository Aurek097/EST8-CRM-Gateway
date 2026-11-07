import { describe, expect, it } from "vitest";
import {
  buildQuoteUrl,
  carrierSuggestions,
  carriersMatch,
  licenseFor,
  licensedStatesOf,
  profileAlerts,
  writingNumbersFor,
  type AgentProfileData,
} from "@/lib/profile";

const now = new Date("2026-11-05T18:00:00Z");
const p: AgentProfileData = {
  licenses: [
    { state: "MI", number: "0123", expires: "2027-06-01", resident: false },
    { state: "TX", number: "999", expires: "2026-12-01", resident: true },
  ],
  writingNumbers: [
    { carrier: "American General", number: "AG1", status: "Appointed" },
    { carrier: "SBLI", number: "S1", status: "Appointed" },
    { carrier: "SBLI", number: "S2", status: "Appointed" },
    { carrier: "Legal & General America", number: "L1", status: "Inactive" },
    { carrier: "Banner Life (BeyondTerm)", number: "B1", status: "Pending" },
  ],
};

describe("profile rules", () => {
  it("Michigan lead gets the MI license number", () =>
    expect(licenseFor(p, "MI")?.number).toBe("0123"));
  it("licensed states come from license rows", () =>
    expect(licensedStatesOf(p)).toEqual(["MI", "TX"]));
  it("Corebridge/AIG and AIG map to American General", () => {
    expect(writingNumbersFor(p, "Corebridge/AIG")[0]?.number).toBe("AG1");
    expect(writingNumbersFor(p, "AIG")[0]?.number).toBe("AG1");
  });
  it("same carrier twice returns both numbers", () =>
    expect(writingNumbersFor(p, "SBLI").map((w) => w.number)).toEqual(["S1", "S2"]));
  it("inactive carriers give no writing number", () =>
    expect(writingNumbersFor(p, "LGA")).toEqual([]));
  it("prefix and parenthetical match", () => {
    expect(carriersMatch("Banner", "Banner Life (BeyondTerm)")).toBe(true);
    expect(carriersMatch("Mutual of Omaha", "Americo")).toBe(false);
  });
  it("suggestions put my carriers first, without parentheses", () =>
    expect(carrierSuggestions(p).slice(0, 3)).toEqual(["American General", "SBLI", "Banner Life"]));
  it("license expiring within 60 days is amber, expired is red", () => {
    expect(profileAlerts(p, now)).toEqual([
      { tone: "warn", text: expect.stringContaining("TX license expires in 26 days") },
    ]);
    expect(
      profileAlerts({ ...p, eoExpires: "2026-11-01" }, now).some(
        (a) => a.tone === "bad" && a.text.includes("E&O"),
      ),
    ).toBe(true);
  });
  it("no licensed states is an amber alert", () =>
    expect(profileAlerts({}, now)[0]?.tone).toBe("warn"));
  it("quote link replaces existing params, keeps others, drops empties", () => {
    const u = new URL(
      buildQuoteUrl("https://x.quoteplicity.com/quote/no-exam?state=CA&ref=7", {
        state: "TX",
        dob: "1960-01-02",
        gender: null,
      })!,
    );
    expect(u.searchParams.get("state")).toBe("TX");
    expect(u.searchParams.get("ref")).toBe("7");
    expect(u.searchParams.has("gender")).toBe(false);
  });
});
