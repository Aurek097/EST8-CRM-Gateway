import { describe, expect, it } from "vitest";
import { guessTarget, mapRow, isSkippable } from "@/lib/import";
import { applyOutcome, parseDate, type LeadRow } from "@/lib/leads";
import { stagePatch } from "@/lib/lead-mutations";
import { leadsToCsv } from "@/lib/export";

const base = (over: Partial<LeadRow> = {}): LeadRow => ({
  id: "1",
  user_id: "u",
  lead_type: "fe",
  status: "new",
  first_name: "Ann",
  last_name: "Lee",
  phone: "2815550100",
  phone_digits: "2815550100",
  email: null,
  address: null,
  city: null,
  state: "MI",
  zip: null,
  lead_source: null,
  lead_date: null,
  sms_opt_out: false,
  sample: false,
  data: {},
  verify: {},
  orig: {},
  stage_at: {},
  log: [],
  dials: 0,
  last_dial: null,
  follow_at: null,
  follow_what: null,
  step: 1,
  created_at: "",
  updated_at: "",
  ...over,
});

describe("GOAT vendor columns map automatically", () => {
  const headers = [
    "Date/Time",
    "First Name",
    "Last Name",
    "DOB",
    "Age",
    "Gender",
    "Phone",
    "Email",
    "State",
    "City",
    "Zip",
    "Amt Requested",
    "Beneficiary",
    "Beneficiary Name",
    "History of Heart Attack Stroke Cancer",
    "Have Life Insurance",
    "Favorite Hobby",
    "Ad",
    "Platform",
    "Interested In",
    "Trusted Form URL",
    "Status",
    "OTP Code",
    "IP Address",
  ];
  it("matches every column", () => {
    expect(headers.map(guessTarget)).toEqual([
      "leadDate",
      "firstName",
      "lastName",
      "dob",
      "age",
      "gender",
      "phone",
      "email",
      "state",
      "city",
      "zip",
      "amountRequested",
      "benRel",
      "beneficiary",
      "heartStrokeCancer",
      "hasLife",
      "hobby",
      "ad",
      "platform",
      "interestedIn",
      "trustedForm",
      "extra",
      "extra",
      "extra",
    ]);
  });
  it("detects final expense and keeps vendor status as extra", () => {
    const row = [
      "2026-11-05 10:00",
      "Ann",
      "Lee",
      "6/3/56",
      "N/A",
      "f",
      "(281) 555-0100",
      "a@b.co",
      "MI",
      "Detroit",
      "48201",
      "$30,000+",
      "Daughter",
      "Jo Lee",
      "no",
      "yes",
      "fishing",
      "ad1",
      "fb",
      "Final Expense",
      "https://cert",
      "New",
      "123",
      "1.1.1.1",
    ];
    const l = mapRow(headers, row, headers.map(guessTarget), "detect");
    expect(l.lead_type).toBe("fe");
    expect(l.phone_digits).toBe("2815550100");
    expect(l.data["dob"]).toBe("1956-06-03");
    expect(l.data["platform"]).toBe("Facebook");
    expect(l.data["amountRequested"]).toBe("$30,000+");
    expect((l.data["extra"] as Record<string, string>)["Status"]).toBe("New");
  });
});

describe("import rules", () => {
  it("skips a row with no name and no phone", () => {
    const l = mapRow(["Email"], ["x@y.z"], ["email"], "detect");
    expect(isSkippable(l)).toBe(true);
  });
  it("parses Excel serial dates", () => {
    expect(parseDate(20609)).toBe("1956-06-03");
  });
});

describe("dial outcomes", () => {
  it("Talked on a New lead moves it to Contacted and adds a dial", () => {
    const p = applyOutcome(base(), "talked");
    expect(p.status).toBe("contacted");
    expect(p.dials).toBe(1);
  });
  it("Sent text does not add a dial", () => {
    expect(applyOutcome(base({ dials: 3 }), "text").dials).toBe(3);
  });
});

describe("stages", () => {
  it("Application fills app date and policy from the chosen option", () => {
    const p = stagePatch(
      base({ data: { chosen: 2, optCov2: "10000", optPrem2: "45" } }),
      "application",
      new Date("2026-11-05T12:00:00Z"),
    );
    const d = p.data as Record<string, unknown>;
    expect(d["appDate"]).toBe("2026-11-05");
    expect(d["polPrem"]).toBe("45");
    expect(p.status).toBe("application");
  });
});

describe("export", () => {
  it("leaves out leads in states the agent isn't licensed in", () => {
    const r = leadsToCsv([base({ state: "MI" }), base({ id: "2", state: "CA" })], ["TX", "MI"]);
    expect(r.count).toBe(1);
    expect(r.skipped).toBe(1);
  });
});
