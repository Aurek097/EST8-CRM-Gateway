import { describe, it, expect, vi, beforeEach } from "vitest";
const f = vi.hoisted(() => ({
  suppression: false,
  consent: { transactional: true, marketing: false },
  responseIds: new Set<string>(),
  rows: [] as any[],
  send: vi.fn(),
  db: null as any,
}));
vi.mock("@/lib/telnyx.server", () => ({ admin: async () => f.db }));
vi.mock("@/lib/agency-a2p.server", () => ({
  agency: async () => ({
    profile: {
      verified: true,
      registrationOwner: "agency-owner",
      supportEmail: "support@example.com",
      supportPhone: "",
      campaign: { optoutMessage: "STOP confirmed", optinMessage: "START confirmed" },
    },
  }),
  member: async () => true,
}));
vi.mock("@/lib/a2p.server", () => ({
  api: (...args: any[]) => f.send(...args),
  verifySmsCompliance: async () => true,
}));
import { consentFailure, handleKeyword } from "@/lib/sms-consent.server";
beforeEach(() => {
  f.suppression = false;
  f.consent = { transactional: true, marketing: false };
  f.responseIds.clear();
  f.rows = [];
  f.send.mockReset();
  f.db = {
    from: (table: string) => {
      let operation = "read",
        value: any;
      const q: any = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: () => Promise.resolve({ data: { suppressed: f.suppression }, error: null }),
        upsert: (v: any) => {
          operation = "upsert";
          value = v;
          return q;
        },
        insert: (v: any) => {
          operation = "insert";
          value = v;
          return q;
        },
        update: () => q,
        then: (resolve: any) => {
          let error = null;
          if (table === "sms_suppressions" && operation === "upsert") {
            f.suppression = value.suppressed;
            f.rows.push(value);
          }
          if (table === "sms_keyword_responses" && operation === "insert") {
            if (f.responseIds.has(value.event_id)) error = { code: "23505" };
            else f.responseIds.add(value.event_id);
          }
          return Promise.resolve({
            data: table === "sms_consent_events" ? [f.consent] : null,
            error,
          }).then(resolve);
        },
      };
      return q;
    },
  };
});
describe("SMS keyword backend with mocked storage/provider", () => {
  it("STOP creates durable agency-wide suppression", async () => {
    await handleKeyword("agent-a", "+12815550100", "+12815550200", "STOP", false, "evt-1");
    expect(f.rows).toContainEqual(
      expect.objectContaining({ user_id: "agency-owner", suppressed: true }),
    );
    expect(await consentFailure("agent-b", "+12815550100", false)).toMatch(/opted-out/);
  });
  it("HELP sends verified support without changing consent", async () => {
    await handleKeyword("agent-a", "+12815550100", "+12815550200", "HELP", false, "evt-2");
    expect(f.send).toHaveBeenCalledWith(
      "/messages",
      "POST",
      expect.objectContaining({ text: expect.stringContaining("support@example.com") }),
    );
    expect(f.suppression).toBe(false);
  });
  it("START never grants promotional consent", async () => {
    f.suppression = true;
    await handleKeyword("agent-a", "+12815550100", "+12815550200", "START", false, "evt-3");
    expect(f.suppression).toBe(false);
    expect(await consentFailure("agent-a", "+12815550100", true)).toMatch(/consent/);
  });
  it("replayed HELP does not send duplicate responses", async () => {
    await handleKeyword("agent-a", "+12815550100", "+12815550200", "HELP", false, "evt-4");
    await handleKeyword("agent-a", "+12815550100", "+12815550200", "HELP", false, "evt-4");
    expect(f.send).toHaveBeenCalledTimes(1);
  });
});
