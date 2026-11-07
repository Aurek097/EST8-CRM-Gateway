import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAgencyAdmin, changeAgency } from "@/lib/agency-a2p.functions";
import { defaultAgency, PUBLIC_OPTIN_URL, type AgencyProfile } from "@/lib/agency-a2p-rules";
import { draftEntities } from "@/lib/a2p-rules";
import type { z } from "zod";
import type { adminActionSchema } from "@/lib/agency-a2p.server";
import { PageHeader } from "./shell";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
export function AgencyA2pAdmin() {
  const get = useServerFn(getAgencyAdmin),
    change = useServerFn(changeAgency),
    qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["agency-admin"], queryFn: () => get() });
  const [f, setF] = useState<AgencyProfile>(defaultAgency),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [agent, setAgent] = useState(""),
    [reason, setReason] = useState(""),
    [reference, setReference] = useState(""),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (data && !loaded) {
      setF(data.profile);
      setLoaded(true);
    }
  }, [data, loaded]);
  const run = async (action: z.infer<typeof adminActionSchema>) => {
    setBusy(true);
    try {
      const r = await change({ data: action });
      if (r.ok) {
        toast.success(r.message);
      } else {
        toast.error(r.message);
      }
      if (r.ok) {
        await qc.invalidateQueries({ queryKey: ["agency-admin"] });
        await qc.invalidateQueries({ queryKey: ["onboarding"] });
      }
    } catch {
      toast.error("Agency settings could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  const field = (label: string, value: string, onChange: (v: string) => void, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={`agency-${label}`}>{label}</Label>
      <Input
        id={`agency-${label}`}
        type={type}
        autoComplete="off"
        value={value}
        maxLength={500}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
  const tick = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <div className="flex items-start gap-3">
      <Checkbox
        id={`agency-${label}`}
        checked={value}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <Label htmlFor={`agency-${label}`} className="font-normal leading-snug">
        {label}
      </Label>
    </div>
  );
  return (
    <div className="mx-auto max-w-4xl space-y-7 p-5 sm:p-6">
      <PageHeader eyebrow="Settings / Agency administration" title="A2P Business Profile" />
      {error && (
        <p role="alert" className="text-danger">
          Administrators only, or agency settings could not be loaded.
        </p>
      )}
      <section className="space-y-5">
        <h2 className="text-xl font-semibold">Verified legal sender</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["companyName", "Legal business name"],
              ["displayName", "DBA / display name"],
              ["ein", "Business EIN (never SSN)"],
              ["street", "Street address"],
              ["city", "City"],
              ["state", "State"],
              ["postalCode", "ZIP code"],
              ["country", "Country"],
              ["website", "Business website"],
              ["firstName", "Authorized representative first name"],
              ["lastName", "Authorized representative last name"],
              ["email", "Representative email"],
              ["phone", "Representative phone"],
              ["mobilePhone", "Verification mobile (sole proprietor)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              {field(
                label,
                f.business[key],
                (v) => setF((x) => ({ ...x, business: { ...x.business, [key]: v } })),
                key === "ein" ? "password" : "text",
              )}
            </div>
          ))}
          <div className="space-y-2">
            <Label htmlFor="agency-entity">Entity type</Label>
            <select
              id="agency-entity"
              value={f.business.entityType}
              onChange={(e) =>
                setF((x) => ({ ...x, business: { ...x.business, entityType: e.target.value } }))
              }
              className="h-10 w-full rounded-md border bg-background px-3"
            >
              {draftEntities.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
          {field("Customer support email", f.supportEmail, (v) =>
            setF((x) => ({ ...x, supportEmail: v })),
          )}
          {field("Customer support phone (+1…)", f.supportPhone, (v) =>
            setF((x) => ({ ...x, supportPhone: v })),
          )}
          {field("Verification / legal authority reference", f.verificationReference, (v) =>
            setF((x) => ({ ...x, verificationReference: v })),
          )}
        </div>
        {tick("I verified this legal business and support contacts", f.verified, (v) =>
          setF((x) => ({ ...x, verified: v })),
        )}
      </section>
      <section className="space-y-5 border-t pt-6">
        <h2 className="text-xl font-semibold">Insurance messaging templates</h2>
        <Label htmlFor="agency-description">Messaging description</Label>
        <textarea
          id="agency-description"
          rows={8}
          value={f.campaign.description}
          maxLength={4096}
          onChange={(e) =>
            setF((x) => ({ ...x, campaign: { ...x.campaign, description: e.target.value } }))
          }
          className="w-full rounded-md border bg-background p-3 text-sm"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {field("Use case", f.campaign.usecase, (v) =>
            setF((x) => ({ ...x, campaign: { ...x.campaign, usecase: v } })),
          )}
          {field("Privacy Policy URL", f.campaign.privacyPolicyLink, (v) =>
            setF((x) => ({ ...x, campaign: { ...x.campaign, privacyPolicyLink: v } })),
          )}
          {field("Terms of Service URL", f.campaign.termsAndConditionsLink, (v) =>
            setF((x) => ({ ...x, campaign: { ...x.campaign, termsAndConditionsLink: v } })),
          )}
          {field("Public opt-in URL", f.campaign.optinUrl, (v) =>
            setF((x) => ({ ...x, campaign: { ...x.campaign, optinUrl: v } })),
          )}
        </div>
        {(["sample1", "sample2", "sample3", "sample4", "sample5"] as const).map((k, i) => (
          <div key={k}>
            {field(`Sample ${i + 1}${i === 4 ? " (marketing only)" : ""}`, f.campaign[k], (v) =>
              setF((x) => ({ ...x, campaign: { ...x.campaign, [k]: v } })),
            )}
          </div>
        ))}
        {tick("Actual campaign includes marketing messages", f.campaign.marketing, (v) =>
          setF((x) => ({ ...x, campaign: { ...x.campaign, marketing: v } })),
        )}
        {tick(
          "Separate marketing consent process is live and verified",
          f.marketingConsentVerified,
          (v) => setF((x) => ({ ...x, marketingConsentVerified: v })),
        )}
      </section>
      <section className="space-y-4 border-t pt-6">
        <h2 className="text-xl font-semibold">Existing approved registration</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("Telnyx Brand ID", f.brandId, (v) => setF((x) => ({ ...x, brandId: v })))}
          {field("Telnyx Campaign ID", f.campaignId, (v) => setF((x) => ({ ...x, campaignId: v })))}
        </div>
        <Label htmlFor="agency-owner">Existing CallDesk registration owner</Label>
        <select
          id="agency-owner"
          value={f.registrationOwner}
          onChange={(e) => setF((x) => ({ ...x, registrationOwner: e.target.value }))}
          className="h-10 w-full rounded-md border bg-background px-3"
        >
          <option value="">Select verified legal representative…</option>
          {data?.agents.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.full_name || a.email}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground">
          Reuse verifies the actual provider identity, campaign scope and agent authorization; it
          never creates another paid registration.
        </p>
      </section>
      <Button disabled={busy} onClick={() => run({ action: "save", profile: f })}>
        Save agency profile
      </Button>
      <section className="space-y-3 border-t pt-5">
        <h2 className="text-xl font-semibold">Agent correction requests</h2>
        {data?.corrections.map((r: any) => (
          <p key={r.id} className="break-words border-b py-3 text-sm">
            {data.agents.find((a: any) => a.id === r.user_id)?.full_name || "Agent"}: {r.request}
          </p>
        ))}
      </section>
      <section className="space-y-4 border-t pt-6">
        <h2 className="text-xl font-semibold">Legal-sender access</h2>
        <Label htmlFor="agency-member">Agent</Label>
        <select
          id="agency-member"
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          className="h-10 w-full rounded-md border bg-background px-3"
        >
          <option value="">Select agent…</option>
          {data?.agents.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.full_name || a.email}
            </option>
          ))}
        </select>
        {field("Basis for legal-sender authorization", reason, setReason)}
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy || !agent || reason.length < 10}
            onClick={() => run({ action: "member", userId: agent, authorized: true, reason })}
          >
            Authorize legal sender
          </Button>
          <Button
            variant="outline"
            disabled={busy || !agent || reason.length < 10}
            onClick={() => run({ action: "member", userId: agent, authorized: false, reason })}
          >
            Revoke authorization
          </Button>
        </div>
        <ul className="divide-y">
          {data?.members.map((m: any) => (
            <li key={m.user_id} className="py-3 text-sm">
              {data.agents.find((a: any) => a.id === m.user_id)?.full_name || m.user_id} ·{" "}
              {m.authorized ? "Authorized" : "Not authorized"}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-4 border-t pt-6">
        <h2 className="text-xl font-semibold">Public consent verification</h2>
        <a href="/sms-consent" className="text-primary underline">
          Open public inquiry form
        </a>
        <p className="text-sm text-muted-foreground">
          {PUBLIC_OPTIN_URL} · {data?.formVerified ? "Published form verified" : "Not verified"}
        </p>
        {field("Published-form test reference", reference, setReference)}
        {tick(
          "I tested the published form with unchecked optional consent and verified the saved choices",
          confirm,
          setConfirm,
        )}
        <Button
          disabled={busy || !confirm || reference.length < 10}
          onClick={() => run({ action: "verifyForm", reference, confirmed: true })}
        >
          Verify published consent process
        </Button>
      </section>
      <section className="space-y-4 border-t pt-6">
        <h2 className="text-xl font-semibold">Telnyx eligibility</h2>
        <p className="text-sm text-warning">
          {data?.capability.capability.blocker || "No current restriction recorded."}
        </p>
        <Button variant="outline" disabled={busy} onClick={() => run({ action: "recheck" })}>
          Recheck registration eligibility
        </Button>
      </section>
    </div>
  );
}
