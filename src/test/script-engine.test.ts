import { describe, expect, it } from "vitest";
import {
  cashflow,
  localTime,
  mpPlan,
  opener,
  quoteCoverage,
  quoteTerm,
  road,
  show,
  token,
  parseHW,
  type Ctx,
} from "@/scripts/engine";
import type { LeadRow } from "@/lib/leads";
import type { Profile } from "@/lib/desk";

const now = new Date("2026-11-05T18:00:00Z");
const lead = (over: Partial<LeadRow> = {}, data: Record<string, unknown> = {}): LeadRow => ({
  id: "1",
  user_id: "u",
  lead_type: "mp",
  status: "new",
  first_name: "Sam",
  last_name: "Ray",
  phone: null,
  phone_digits: null,
  email: null,
  address: null,
  city: "Austin",
  state: "TX",
  zip: null,
  lead_source: null,
  lead_date: null,
  sms_opt_out: false,
  sample: false,
  data: data as LeadRow["data"],
  verify: {},
  orig: {},
  stage_at: {},
  log: [],
  dials: 0,
  last_dial: null,
  follow_at: null,
  follow_what: null,
  step: 1,
  created_at: now.toISOString(),
  updated_at: "",
  ...over,
});
const me = {
  full_name: "Andrew Chavis",
  phone: "2816354471",
  npn: "123",
  licensed_states: ["TX"],
  profile: {},
  settings: {},
} as unknown as Profile;
const ctx = (l: LeadRow): Ctx => ({ lead: l, me, now });

describe("opener", () => {
  it("2 hours old opens on A, 12 days old on B", () => {
    expect(opener(lead({ lead_date: new Date(+now - 2 * 36e5).toISOString() }), now)).toBe("A");
    expect(opener(lead({ lead_date: new Date(+now - 12 * 864e5).toISOString() }), now)).toBe("B");
  });
});

describe("tokens", () => {
  it("fills from the lead and is missing (null) when absent", () => {
    expect(token("first", ctx(lead()))).toBe("Sam");
    expect(token("beneficiary", ctx(lead()))).toBeNull();
  });
  it("andSpouse disappears when single", () => {
    expect(token("andSpouse", ctx(lead({}, { married: "Single" })))).toBe("");
    expect(token("andSpouse", ctx(lead({}, { married: "Married", spouseName: "Tanya" })))).toBe(
      " and Tanya",
    );
  });
  it("benIsnt pluralizes", () => {
    expect(token("benIsnt", ctx(lead({}, { beneficiary: "Lisa and Richard" })))).toBe("aren't");
  });
});

describe("show-when", () => {
  it("married and stayNow rules", () => {
    const l = lead({}, { married: "Married", stayNow: "Yes, present now" });
    expect(show("married", ctx(l))).toBe(true);
    expect(show("!stayYes", ctx(l))).toBe(false);
    expect(show("married", ctx(lead({}, { married: "Single" })))).toBe(false);
  });
});

describe("calculations", () => {
  it("equity = home value − loan", () => {
    expect(token("equity", ctx(lead({}, { homeValue: "400000", loanAmount: 286000 })))).toBe(
      "$114,000",
    );
  });
  it("cash flow survivors", () => {
    const c = cashflow(
      lead(
        {},
        {
          married: "Married",
          incomeA: "5000",
          incomeB: "3000",
          otherIncome: "500",
          monthlyPayment: "2000",
          otherBills: "3000",
        },
      ),
    );
    expect(c.income).toBe(8500);
    expect(c.extra).toBe(3500);
    expect(c.withoutA).toBe(-1500);
    expect(c.withoutB).toBe(500);
  });
  it("10% anchor and critical period months × payment", () => {
    expect(mpPlan(lead({}, { monthlyPayment: "2000", program: "Full payoff" })).anchor).toBe(200);
    expect(
      mpPlan(lead({}, { monthlyPayment: "2000", program: "Critical period", monthsNeeded: "12" }))
        .covs,
    ).toEqual([30000, 24000, 18000]);
  });
  it("partial payoff, $286,000 loan, 30-year → coverage 143000, term 30", () => {
    const l = lead({}, { loanAmount: 286000, program: "Partial payoff", loanTerm: "30-year" });
    expect(quoteCoverage(l)).toBe(143000);
    expect(quoteTerm(l)).toBe(30);
  });
  it("suggested road: over 65 → critical period", () => {
    expect(road(lead({}, { dob: "1950-01-01" }), now).road).toBe("cp");
    expect(road(lead({}, { dob: "1990-01-01", health: "none" }), now).road).toBe("full");
  });
  it("parses height and weight", () => {
    expect(parseHW("5'10, 180")).toEqual({ feet: 5, inches: 10, pounds: 180 });
  });
});

describe("calling hours", () => {
  it("9:30 p.m. in the client's time zone is outside hours", () => {
    const t = localTime("TX", new Date("2026-11-06T03:30:00Z")); // 9:30 pm CST
    expect(t?.ok).toBe(false);
    expect(localTime("TX", new Date("2026-11-05T18:00:00Z"))?.ok).toBe(true);
  });
});
