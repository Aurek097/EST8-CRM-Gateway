import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Save, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getOnboarding, reuseAgency, requestCorrection } from "@/lib/agency-a2p.functions";
import { getA2p, changeA2p, type A2pAction } from "@/lib/a2p.functions";
import {
  emptyBusiness,
  emptyCampaign,
  stageLabel,
  smsReady,
  type Business,
  type Campaign,
} from "@/lib/a2p-rules";
import { useDesk } from "@/lib/desk";
import { AdvancedA2pRegistration } from "./a2p-registration";
import { PageHeader } from "./shell";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
export function A2pRegistration() {
  const { me, isAdmin } = useDesk(),
    qc = useQueryClient(),
    get = useServerFn(getA2p),
    agency = useServerFn(getOnboarding),
    change = useServerFn(changeA2p),
    reuse = useServerFn(reuseAgency),
    correction = useServerFn(requestCorrection);
  const { data, error } = useQuery({
    queryKey: ["a2p-self", me.id],
    queryFn: () => get(),
    refetchInterval: 60000,
  });
  const { data: a } = useQuery({ queryKey: ["onboarding", me.id], queryFn: () => agency() });
  const [advanced, setAdvanced] = useState(false),
    [step, setStep] = useState(0),
    [business, setBusiness] = useState<Business>(emptyBusiness),
    [campaign, setCampaign] = useState<Campaign>(emptyCampaign),
    [loaded, setLoaded] = useState(false),
    [personal, setPersonal] = useState(false),
    [legal, setLegal] = useState(false),
    [program, setProgram] = useState(false),
    [billing, setBilling] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [request, setRequest] = useState("");
  useEffect(() => {
    if (data && a && !loaded) {
      const inherited = data.business.relationship === "est8" && a.eligible;
      setBusiness(inherited ? { ...a.business, legalAuthority: false } : data.business);
      setCampaign(
        inherited
          ? a.campaign
          : data.campaign.description
            ? data.campaign
            : {
                ...a.campaign,
                description: a.campaign.description.replaceAll(
                  "EST8 Financial Group",
                  data.business.displayName || "[LEGAL BUSINESS]",
                ),
                sample1: "",
                sample2: "",
                sample3: "",
                sample4: "",
                sample5: "",
                messageFlow: "",
                optinUrl: "",
                privacyPolicyLink: "",
                termsAndConditionsLink: "",
                subscriberOptin: false,
              },
      );
      setLoaded(true);
    }
  }, [data, a, loaded]);
  if (advanced)
    return (
      <>
        <div className="mx-auto max-w-4xl px-6 pt-5">
          <Button variant="outline" onClick={() => setAdvanced(false)}>
            Back to simplified onboarding
          </Button>
        </div>
        <AdvancedA2pRegistration />
      </>
    );
  if (error) return <p className="p-6 text-danger">Registration could not be loaded.</p>;
  if (!data || !a) return <p className="p-6 text-muted-foreground">Opening onboarding…</p>;
  const r = data.registration,
    shared = business.relationship === "est8",
    kind = r?.brand_id ? "campaign" : "brand",
    ready = data.links.some((n) => smsReady(r, n));
  const run = async (action: A2pAction) => {
    setBusy(true);
    setMessage("");
    try {
      const result = await change({ data: action });
      setMessage(result.message);
      if (result.ok) {
        await qc.invalidateQueries({ queryKey: ["a2p-self"] });
        setBilling(false);
      }
    } catch {
      setMessage("Registration could not be confirmed. Your draft remains available.");
    } finally {
      setBusy(false);
    }
  };
  const tick = (id: string, label: string, value: boolean, set: (v: boolean) => void) => (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={value} onCheckedChange={(v) => set(v === true)} />
      <Label htmlFor={id} className="font-normal leading-snug">
        {label}
      </Label>
    </div>
  );
  const status = !data.capability.ok
    ? "Submission Blocked"
    : ready
      ? "SMS Ready"
      : r?.stage === "ready"
        ? "Awaiting Authorization"
        : stageLabel(r) === "Identity Verification Pending"
          ? "Verification Required"
          : stageLabel(r);
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap justify-between gap-3">
        <PageHeader eyebrow="Phone system / Agent onboarding" title="A2P Registration" />
        {isAdmin && (
          <Button asChild variant="outline">
            <Link to="/agency-a2p">Agency administration</Link>
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2 border-y py-4 font-semibold">
        <ShieldCheck className={ready ? "text-success" : "text-warning"} />
        {status}
      </div>
      {!data.capability.ok && (
        <div
          role="alert"
          className="rounded-md border border-warning bg-warning-soft p-4 text-sm text-warning"
        >
          {data.capability.blocker} Drafts can still be saved. An administrator can recheck
          eligibility.
        </div>
      )}
      <nav aria-label="Agent onboarding steps" className="grid gap-2 sm:grid-cols-3">
        {["Confirm details", "Review messaging", "Review & authorize"].map((s, i) => (
          <Button
            key={s}
            variant={step === i ? "default" : "outline"}
            className="h-12 whitespace-normal"
            onClick={() => setStep(i)}
          >
            {i + 1}. {s}
          </Button>
        ))}
      </nav>
      {message && (
        <p role="status" className="rounded-md border p-4 text-sm">
          {message}
        </p>
      )}
      {step === 0 && (
        <section className="space-y-5">
          <h2 className="text-xl font-semibold">Agent & legal sender</h2>
          <dl className="grid grid-cols-2 gap-3 border-b pb-4 text-sm">
            <dt>Name</dt>
            <dd>{me.full_name || "Not provided"}</dd>
            <dt>Email</dt>
            <dd className="break-all">{me.email}</dd>
            <dt>Business phone</dt>
            <dd>{me.phone || "Add your phone in Profile"}</dd>
            <dt>Associated agency</dt>
            <dd>EST8 Financial Group</dd>
          </dl>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              disabled={!!r?.brand_id || !!r?.agency_registration_id}
              variant={shared ? "default" : "outline"}
              onClick={() => {
                if (!a.eligible) {
                  setMessage(
                    "Agency legal identity and your individual sender authorization must be verified by your administrator first.",
                  );
                  return;
                }
                setBusiness({ ...a.business, legalAuthority: false });
                setCampaign(a.campaign);
                setLegal(false);
                setBilling(false);
              }}
            >
              Verified EST8 legal business
            </Button>
            <Button
              disabled={!!r?.brand_id || !!r?.agency_registration_id}
              variant={!shared ? "default" : "outline"}
              onClick={() => {
                setBusiness({
                  ...emptyBusiness,
                  firstName: me.full_name?.split(" ")[0] || "",
                  lastName: me.full_name?.split(" ").slice(1).join(" ") || "",
                  email: me.email,
                  phone: me.phone || "",
                });
                setCampaign(emptyCampaign);
                setLegal(false);
                setBilling(false);
              }}
            >
              Independent legal business
            </Button>
          </div>
          {shared ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt>Registered legal name</dt>
              <dd>{business.companyName || "Awaiting administrator verification"}</dd>
              <dt>DBA</dt>
              <dd>{business.displayName}</dd>
              <dt>Legal address</dt>
              <dd>
                {[business.street, business.city, business.state, business.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </dd>
              <dt>Industry</dt>
              <dd>Insurance</dd>
            </dl>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Independent businesses keep their own legal information and consent program.
              </p>
              <Label htmlFor="independent-name">Legal business name</Label>
              <Input
                id="independent-name"
                value={business.companyName}
                maxLength={100}
                onChange={(e) =>
                  setBusiness((v) => ({
                    ...v,
                    companyName: e.target.value,
                    displayName: e.target.value,
                  }))
                }
              />
              <Button variant="outline" onClick={() => setAdvanced(true)}>
                Complete independent business details
              </Button>
            </div>
          )}
          {tick("verify-personal", "I verified my personal contact details", personal, setPersonal)}
          {tick(
            "verify-legal",
            "I am authorized to represent the selected actual legal business",
            legal,
            setLegal,
          )}
        </section>
      )}
      {step === 1 && (
        <section className="space-y-5">
          <h2 className="text-xl font-semibold">Insurance messaging program</h2>
          <div className="whitespace-pre-line border-y py-5 text-sm leading-relaxed">
            {campaign.description ||
              "Complete your independent messaging program in detailed registration."}
          </div>
          <h3 className="font-semibold">Consent method</h3>
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {campaign.messageFlow ||
              "No published, functioning opt-in process has been verified. Consent is not assumed."}
          </p>
          <ul className="space-y-3">
            {[
              campaign.sample1,
              campaign.sample2,
              campaign.sample3,
              campaign.sample4,
              campaign.sample5,
            ]
              .filter(Boolean)
              .map((s, i) => (
                <li key={i} className="border-l-2 border-primary pl-4 text-sm">
                  <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                    Sample {i + 1}
                  </span>
                  {s}
                </li>
              ))}
          </ul>
          <dl className="grid grid-cols-2 gap-3 border-y py-4 text-sm">
            <dt>START</dt>
            <dd>{campaign.optinMessage || "Not configured"}</dd>
            <dt>STOP</dt>
            <dd>{campaign.optoutMessage || "Not configured"}</dd>
            <dt>HELP</dt>
            <dd>{campaign.helpMessage || "Verified support contact required"}</dd>
            <dt>Number pooling</dt>
            <dd>Disabled</dd>
            <dt>Marketing</dt>
            <dd>
              {campaign.marketing ? "Verified separate marketing consent required" : "Not included"}
            </dd>
          </dl>
          {tick(
            "review-program",
            "I reviewed the messaging program and actual consent evidence",
            program,
            setProgram,
          )}
          <Label htmlFor="correction-request">Request a correction</Label>
          <textarea
            id="correction-request"
            value={request}
            maxLength={2000}
            onChange={(e) => setRequest(e.target.value)}
            rows={3}
            className="w-full rounded-md border bg-background p-3 text-sm"
          />
          <Button
            variant="outline"
            disabled={request.length < 10 || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await correction({ data: { request } });
                if (result.ok) {
                  toast.success("Correction request sent to your administrator.");
                } else {
                  toast.error("Could not send correction request.");
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            Send correction request
          </Button>
        </section>
      )}
      {step === 2 && (
        <section className="space-y-5">
          <h2 className="text-xl font-semibold">Review & authorize</h2>
          <dl className="grid grid-cols-2 gap-3 border-y py-4 text-sm">
            <dt>Legal business</dt>
            <dd>{business.companyName || business.displayName || "Not completed"}</dd>
            <dt>Use case</dt>
            <dd>{campaign.usecase || "Not selected"}</dd>
            <dt>Consent evidence</dt>
            <dd>
              {shared && a.formVerified
                ? "Published agency form verified"
                : "Verification required"}
            </dd>
            <dt>Assigned numbers</dt>
            <dd>{data.numbers.map((n) => n.phone_number).join(", ") || "No number assigned"}</dd>
            <dt>Registration status</dt>
            <dd>{status}</dd>
          </dl>
          {data.fees ? (
            <p className="text-sm">
              Brand ${data.fees.brand.toFixed(2)} · Review ${data.fees.review.toFixed(2)} · Campaign
              upfront ${data.fees.upfront.toFixed(2)} · Monthly ${data.fees.monthly.toFixed(2)}{" "}
              {data.fees.currency}
            </p>
          ) : (
            <p className="text-sm text-warning">
              Applicable fees must be confirmed before paid submission. Existing approved
              registration reuse does not create a new brand or campaign.
            </p>
          )}
          {tick(
            "authorize-billing",
            "I explicitly authorize this registration/reuse and applicable reviewed charges. No recurring fees are authorized automatically.",
            billing,
            setBilling,
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busy || !personal || !legal || !program || !data.capability.ok}
              onClick={() => run({ action: "review", kind })}
            >
              Review current fees
            </Button>
            {shared && a.sharedAvailable ? (
              <Button
                disabled={
                  busy ||
                  !personal ||
                  !legal ||
                  !program ||
                  !billing ||
                  !a.formVerified ||
                  !data.capability.ok ||
                  !!r?.agency_registration_id
                }
                onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await reuse({ data: { authorized: true } });
                    setMessage(result.message);
                    await qc.invalidateQueries({ queryKey: ["a2p-self"] });
                  } finally {
                    setBusy(false);
                    setBilling(false);
                  }
                }}
              >
                Authorize approved registration reuse
              </Button>
            ) : (
              <Button
                disabled={
                  busy ||
                  !personal ||
                  !legal ||
                  !program ||
                  !billing ||
                  !data.fees ||
                  !data.capability.ok
                }
                onClick={() => run({ action: "submit", kind, authorized: true })}
              >
                Authorize & submit {kind}
              </Button>
            )}
          </div>
          <h3 className="font-semibold">Phone number association</h3>
          <ul className="divide-y">
            {data.numbers.map((n) => (
              <li key={n.phone_number} className="flex flex-wrap justify-between gap-3 py-3">
                <span className="font-mono text-sm">
                  {n.phone_number} ·{" "}
                  {data.links.find((l) => l.phone_number === n.phone_number)?.status ||
                    "Not associated"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !r?.campaign_id || r.campaign_status !== "MNO_PROVISIONED"}
                  onClick={() => run({ action: "assign", phone: n.phone_number })}
                >
                  Associate number
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="outline" onClick={() => setAdvanced(true)}>
            Verification, submission history & detailed settings
          </Button>
        </section>
      )}
      <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
        <Button
          variant="outline"
          disabled={busy || !!r?.campaign_id || !!r?.agency_registration_id}
          onClick={() =>
            run({
              action: "save",
              business: { ...business, legalAuthority: legal },
              campaign: { ...campaign, consentConfirmed: program },
            })
          }
        >
          <Save /> Save draft
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft />
            Back
          </Button>
          <Button disabled={step === 2} onClick={() => setStep((s) => s + 1)}>
            Continue
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
