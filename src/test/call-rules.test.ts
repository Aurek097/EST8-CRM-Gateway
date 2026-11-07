import { describe, expect, it } from "vitest";
import {
  callRuleFailure,
  decodeState,
  encodeState,
  hangupOutcome,
  optChange,
  pickCallerId,
  textRuleFailure,
  toE164,
} from "@/lib/call-rules";

// 2026-11-05 18:00 UTC = noon in Texas (CST), 7 a.m. in Hawaii... use explicit states below.
const noon = new Date("2026-11-05T18:00:00Z");
const late = new Date("2026-11-06T04:00:00Z"); // 10 p.m. Central
const lead = { phone: "(281) 555-0177", status: "new", state: "TX", sms_opt_out: false };

describe("call rules (in the spec's order)", () => {
  it("allows a licensed lead inside calling hours", () =>
    expect(callRuleFailure(lead, ["TX"], noon)).toBeNull());
  it("blocks non-U.S. numbers first", () =>
    expect(
      callRuleFailure({ ...lead, phone: "+44 20 7946 0958", status: "dnc" }, ["TX"], noon),
    ).toMatch(/U\.S\./));
  it("blocks Do not call", () =>
    expect(callRuleFailure({ ...lead, status: "dnc" }, ["TX"], noon)).toMatch(/Do not call/));
  it("blocks a lead with no state", () =>
    expect(callRuleFailure({ ...lead, state: null }, ["TX"], noon)).toMatch(/no state/));
  it("blocks when the agent has no licensed states", () =>
    expect(callRuleFailure(lead, [], noon)).toMatch(/no licensed states/));
  it("names the unlicensed state", () =>
    expect(callRuleFailure({ ...lead, state: "CA" }, ["TX"], noon)).toBe(
      "This lead is in CA, which is not one of your licensed states.",
    ));
  it("blocks after 9 p.m. lead time", () =>
    expect(callRuleFailure(lead, ["TX"], late)).toMatch(/8 a\.m\. to 9 p\.m\./));
});

describe("text rules", () => {
  it("blocks STOP leads", () =>
    expect(textRuleFailure({ ...lead, sms_opt_out: true }, "hi", "+12815550100")).toBe(
      "This lead replied STOP.",
    ));
  it("caps at 1,500 characters", () =>
    expect(textRuleFailure(lead, "x".repeat(1501), "+12815550100")).toMatch(/1,500/));
  it("needs a number to send from", () =>
    expect(textRuleFailure(lead, "hi", null)).toMatch(/no number/));
  it("allows a valid text", () => expect(textRuleFailure(lead, "hi", "+12815550100")).toBeNull());
});

describe("helpers", () => {
  it("normalizes U.S. numbers", () => {
    expect(toE164("281-555-0177")).toBe("+12815550177");
    expect(toE164("1 (281) 555 0177")).toBe("+12815550177");
    expect(toE164("123")).toBeNull();
  });
  it("STOP words and START words", () => {
    expect(optChange(" stop ")).toBe("stop");
    expect(optChange("Unstop")).toBe("start");
    expect(optChange("stop calling")).toBeNull();
  });
  it("caller ID prefers the lead's state, then primary caller ID", () => {
    const nums = [
      { phone_number: "+13135550100", region: "MI", is_primary: true },
      { phone_number: "+12815550100", region: "TX", is_primary: false },
    ];
    expect(pickCallerId(nums, "Texas", null, null)).toBe("+12815550100");
    expect(pickCallerId(nums, "OH", "+17135550100", null)).toBe("+17135550100");
    expect(pickCallerId(nums, "OH", null, null)).toBe("+13135550100");
    expect(pickCallerId([], "OH", null, "+18005550100")).toBe("+18005550100");
  });
  it("hang-up outcomes", () => {
    expect(hangupOutcome("normal_clearing", true)).toBe("answered");
    expect(hangupOutcome("user_busy", false)).toBe("busy");
    expect(hangupOutcome("timeout", false)).toBe("no answer");
  });
  it("client state round-trips", () =>
    expect(decodeState(encodeState({ k: "lead", n: 2 }))).toEqual({ k: "lead", n: "2" }));
});
