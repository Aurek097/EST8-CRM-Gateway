import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { RefreshCw, Save, ShieldCheck, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { getA2p, changeA2p, adminA2p, type A2pAction } from "@/lib/a2p.functions";
import {
  emptyBusiness,
  emptyCampaign,
  businessErrors,
  campaignErrors,
  brandVerified,
  campaignApproved,
  smsReady,
  stageLabel,
  type Business,
  type Campaign,
} from "@/lib/a2p-rules";
import { useDesk } from "@/lib/desk";
import { PageHeader, Panel } from "./shell";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { A2pAppeal } from "./a2p-appeal";

function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
}) {
  const id = `a2p-${label.replace(/\W/g, "-")}`;
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={4096}
          rows={4}
          className="w-full rounded-md border bg-background p-3 text-sm"
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          maxLength={500}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
function Tick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = `tick-${label.replace(/\W/g, "-")}`;
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={value} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="font-normal leading-snug">
        {label}
      </Label>
    </div>
  );
}
function Choice({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`choice-${label}`}>{label}</Label>
      <select
        id={`choice-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        <option value="">Select…</option>
        {[...new Set([value, ...values])].filter(Boolean).map((v) => (
          <option key={v} value={v}>
            {v.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AdvancedA2pRegistration() {
  const { me } = useDesk();
  const qc = useQueryClient();
  const get = useServerFn(getA2p),
    change = useServerFn(changeA2p);
  const { data, error, isPending } = useQuery({
    queryKey: ["a2p-self", me.id],
    queryFn: () => get(),
    refetchInterval: 60000,
  });
  const [b, setB] = useState<Business>(emptyBusiness),
    [c, setC] = useState<Campaign>(emptyCampaign);
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [errors, setErrors] = useState<string[]>([]),
    [consent, setConsent] = useState(false),
    [pin, setPin] = useState("");
  const [loaded, setLoaded] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (data && !loaded) {
      setB(data.business);
      setC(data.campaign);
      setLoaded(true);
    }
  }, [data, loaded]);
  const editB = (key: keyof Business, value: string | boolean) => {
    setB((v) => ({ ...v, [key]: value }));
    setDirty(true);
    setConsent(false);
  };
  const editC = (key: keyof Campaign, value: string | boolean) => {
    setC((v) => ({ ...v, [key]: value }));
    setDirty(true);
    setConsent(false);
  };
  const run = async (action: A2pAction) => {
    setBusy(true);
    setErrors([]);
    try {
      const result = await change({ data: action });
      if (!result.ok) {
        setErrors([result.message]);
        return false;
      }
      toast.success(result.message);
      if (action.action === "save") {
        setDirty(false);
        setB((v) => ({ ...v, ein: v.ein ? "•••••••••" : "" }));
      }
      await qc.invalidateQueries({ queryKey: ["a2p-self"] });
      await qc.invalidateQueries({ queryKey: ["a2p-admin"] });
      setConsent(false);
      return true;
    } catch {
      setErrors(["Registration service could not be reached. No approval is assumed."]);
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (isPending) return <div className="p-6 text-muted-foreground">Opening registration…</div>;
  if (error || !data)
    return <div className="p-6 text-danger">Registration could not be loaded. Please refresh.</div>;
  const r = data.registration;
  const kind = r?.brand_id ? "campaign" : "brand";
  const ready = data.links.some((n) => smsReady(r, n));
  const locked = !!r?.brand_id;
  const steps = [
    "Legal business",
    "Business details",
    "Messaging program",
    "Review & authorize",
    "Status & numbers",
  ];
  const save = () => run({ action: "save", business: b, campaign: c });
  const next = () => {
    const e =
      step === 1
        ? businessErrors(
            { ...b, ein: b.ein === "•••••••••" ? "123456789" : b.ein },
            data.enums.entities,
            data.enums.verticals,
          )
        : [];
    setErrors(e);
    if (!e.length) setStep((s) => Math.min(4, s + 1));
  };
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader eyebrow="Settings / Phone system" title="A2P Registration" />
        <Button
          variant="outline"
          onClick={() => run({ action: "sync" })}
          disabled={busy || !r?.brand_id}
        >
          <RefreshCw /> Refresh status
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y py-4">
        <span className="flex items-center gap-2 font-semibold">
          <ShieldCheck className={ready ? "text-success" : "text-warning"} />
          {stageLabel(r, ready)}
        </span>
        <span className="text-xs text-muted-foreground">
          {r?.synced_at
            ? `Checked ${new Date(r.synced_at).toLocaleString()}`
            : "No registration submitted"}
        </span>
      </div>
      {!data.capability.ok && (
        <div
          role="alert"
          className="rounded-md border border-warning bg-warning-soft p-4 text-sm text-warning"
        >
          {data.capability.blocker}
        </div>
      )}
      {r?.blocker && (
        <p role="alert" className="text-sm text-danger">
          {r.blocker}
        </p>
      )}
      <nav aria-label="Registration progress" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {steps.map((label, i) => (
          <Button
            key={label}
            variant={i === step ? "default" : "outline"}
            onClick={() => {
              setStep(i);
              setErrors([]);
            }}
            className="h-auto min-h-12 whitespace-normal text-left"
          >
            <span className="shrink-0 font-mono">
              {i < step ? <Check className="size-4" /> : i + 1}
            </span>
            {label}
          </Button>
        ))}
      </nav>
      <progress
        aria-label="Registration progress"
        max={5}
        value={step + 1}
        className="h-1 w-full accent-primary"
      />
      {errors.length > 0 && (
        <div
          role="alert"
          className="space-y-1 rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger"
        >
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}
      {step === 0 && (
        <section className="space-y-5">
          <h2 className="text-xl font-semibold">Which legal business do you represent?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["independent", "My own legal business", "Independent agent or agency"],
                [
                  "est8",
                  "EST8 Financial Group",
                  "Authorized representative of EST8’s legal entity",
                ],
              ] as const
            ).map(([v, l, d]) => (
              <Button
                key={v}
                disabled={locked}
                variant={b.relationship === v ? "default" : "outline"}
                className="h-auto min-h-24 flex-col items-start whitespace-normal p-4"
                onClick={() => editB("relationship", v)}
              >
                <span>{l}</span>
                <span className="text-xs font-normal">{d}</span>
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Being in EST8’s downline does not authorize using its EIN. The registration must match
            the business legally responsible for the messages.
          </p>
          <Tick
            label="I am authorized to represent this actual legal entity and certify the information is accurate."
            value={b.legalAuthority}
            onChange={(v) => editB("legalAuthority", v)}
          />
        </section>
      )}
      {step === 1 && (
        <section className="space-y-5">
          <h2 className="text-xl font-semibold">Legal business & representative</h2>
          {locked && (
            <p className="text-sm text-muted-foreground">
              Submitted legal details are locked. Campaign details can still be saved before
              campaign submission.
            </p>
          )}
          <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
            <Choice
              label="Entity type"
              value={b.entityType}
              values={data.enums.entities}
              onChange={(v) => editB("entityType", v)}
            />
            <Choice
              label="Industry"
              value={b.vertical}
              values={data.enums.verticals}
              onChange={(v) => editB("vertical", v)}
            />
            {(
              [
                ["companyName", "Legal business name"],
                ["displayName", "Display / DBA name"],
                ["website", "Business website"],
                ["street", "Legal street address"],
                ["city", "City"],
                ["state", "State / province"],
                ["postalCode", "ZIP / postal code"],
                ["country", "Country (ISO2)"],
                ["firstName", "Representative first name"],
                ["lastName", "Representative last name"],
                ["email", "Representative email"],
                ["phone", "Representative phone (+1…)"],
              ] as const
            ).map(([k, l]) => (
              <Field key={k} label={l} value={b[k]} onChange={(v) => editB(k, v)} />
            ))}
            {b.entityType === "SOLE_PROPRIETOR" ? (
              <Field
                label="Verification mobile (+1…)"
                value={b.mobilePhone}
                onChange={(v) => editB("mobilePhone", v)}
              />
            ) : (
              <Field
                label="Business EIN / supported tax identifier (never SSN)"
                type="password"
                value={b.ein}
                onChange={(v) => editB("ein", v)}
              />
            )}
            {b.entityType === "PUBLIC_PROFIT" && (
              <>
                <Field
                  label="Stock symbol"
                  value={b.stockSymbol}
                  onChange={(v) => editB("stockSymbol", v)}
                />
                <Choice
                  label="Stock exchange"
                  value={b.stockExchange}
                  values={data.enums.exchanges}
                  onChange={(v) => editB("stockExchange", v)}
                />
                <Field
                  label="Public company contact email"
                  value={b.businessContactEmail}
                  onChange={(v) => editB("businessContactEmail", v)}
                />
              </>
            )}
            <Tick
              label="This business is a reseller / ISV"
              value={b.isReseller}
              onChange={(v) => editB("isReseller", v)}
            />
          </fieldset>
          <p className="text-xs text-muted-foreground">
            Tax identifiers are encrypted, kept off browser storage and never returned after saving.
            Sole proprietors do not supply an EIN or SSN.
          </p>
        </section>
      )}
      {step === 2 && (
        <section className="space-y-5">
          <h2 className="text-xl font-semibold">Messaging program & consent</h2>
          {!brandVerified(r?.brand_status ?? "") && (
            <p className="text-sm text-warning">
              You may prepare a draft. Campaign submission requires verified business identity.
            </p>
          )}
          <fieldset disabled={!!r?.campaign_id} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Choice
                label="Telnyx use case"
                value={c.usecase}
                values={data.enums.usecases}
                onChange={(v) => editC("usecase", v)}
              />
              <Field
                label="Reseller ID (if applicable)"
                value={c.resellerId}
                onChange={(v) => editC("resellerId", v)}
              />
            </div>
            {(
              [
                ["description", "Insurance messaging program description"],
                ["messageFlow", "How subscribers opt in and how messages are sent"],
                ["sample1", "Sample message 1"],
                ["sample2", "Sample message 2"],
                ["sample3", "Sample message 3 (optional)"],
                ["sample4", "Sample message 4 (optional)"],
                ["sample5", "Sample message 5 (optional)"],
              ] as const
            ).map(([k, l]) => (
              <Field key={k} label={l} multiline value={c[k]} onChange={(v) => editC(k, v)} />
            ))}
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["optinUrl", "Public opt-in form / evidence URL"],
                  ["privacyPolicyLink", "Privacy policy URL"],
                  ["termsAndConditionsLink", "Terms URL"],
                  ["optinKeywords", "Opt-in keywords"],
                  ["optoutKeywords", "Opt-out keywords"],
                  ["helpKeywords", "Help keywords"],
                  ["optinMessage", "Opt-in response"],
                  ["optoutMessage", "Opt-out response"],
                  ["helpMessage", "Help response"],
                  ["embeddedLinkSample", "Sample embedded link (if used)"],
                ] as const
              ).map(([k, l]) => (
                <Field key={k} label={l} value={c[k]} onChange={(v) => editC(k, v)} />
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["marketing", "Messages contain marketing / promotions"],
                  ["embeddedLink", "Messages contain links"],
                  ["embeddedPhone", "Messages contain phone numbers"],
                  ["ageGated", "Age-gated content"],
                  ["directLending", "Direct lending / loan arrangements"],
                  ["numberPool", "Uses a pool of numbers"],
                  ["subscriberOptin", "Subscribers explicitly opt in"],
                  ["subscriberOptout", "STOP / opt-out is supported"],
                  ["subscriberHelp", "HELP is supported"],
                  ["termsAndConditions", "I accept the applicable registration terms"],
                  ["autoRenewal", "Authorize campaign subscription auto-renewal"],
                  [
                    "consentConfirmed",
                    "I have actual opt-in evidence; purchased leads are not automatically opted in",
                  ],
                ] as const
              ).map(([k, l]) => (
                <Tick key={k} label={l} value={c[k]} onChange={(v) => editC(k, v)} />
              ))}
            </div>
          </fieldset>
        </section>
      )}
      {step === 3 && (
        <section className="space-y-5">
          <h2 className="text-xl font-semibold">
            Review {kind === "brand" ? "brand" : "campaign"} submission
          </h2>
          <dl className="grid grid-cols-2 gap-3 border-y py-4 text-sm">
            <dt className="text-muted-foreground">Legal entity</dt>
            <dd className="break-words">{b.companyName || b.displayName || "Not entered"}</dd>
            <dt className="text-muted-foreground">Registration relationship</dt>
            <dd>{b.relationship === "est8" ? "EST8 legal entity" : "Independent business"}</dd>
            <dt className="text-muted-foreground">Use case</dt>
            <dd>{c.usecase || "Not selected"}</dd>
          </dl>
          {data.fees ? (
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold">Applicable fees · {data.fees.currency}</h3>
              <p>
                Brand registration: ${data.fees.brand.toFixed(2)} · Campaign review: $
                {data.fees.review.toFixed(2)}
              </p>
              <p>
                Campaign upfront: ${data.fees.upfront.toFixed(2)} · Monthly: $
                {data.fees.monthly.toFixed(2)}
              </p>
              <p className="break-words text-xs text-muted-foreground">
                Source: {data.fees.source} · Confirmed{" "}
                {new Date(data.fees.confirmed_at).toLocaleDateString()}
              </p>
              <p className="text-warning">
                Registration/review charges may be non-refundable. Carrier messaging charges are
                additional.
              </p>
            </div>
          ) : (
            <p className="text-sm text-warning">
              Current brand and review charges must be confirmed by an admin. Submission stays
              blocked until the full fee review is available.
            </p>
          )}
          <Button
            variant="outline"
            disabled={busy || dirty || !data.capability.ok}
            onClick={() => {
              const e = kind === "campaign" ? campaignErrors(c, data.enums.usecases) : [];
              if (e.length) setErrors(e);
              else run({ action: "review", kind });
            }}
          >
            <ShieldCheck /> Check eligibility & fees
          </Button>
          {dirty && (
            <p className="text-sm text-warning">Save your latest changes before checking fees.</p>
          )}
          <Tick
            label="I am authorized to submit this legal business / campaign and explicitly authorize the displayed applicable charges."
            value={consent}
            onChange={setConsent}
          />
          <Button
            disabled={
              busy || dirty || !consent || !data.fees || !data.capability.ok || !!r?.campaign_id
            }
            onClick={() => run({ action: "submit", kind, authorized: true })}
          >
            Authorize & submit {kind}
          </Button>
        </section>
      )}
      {step === 4 && (
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">Registration status & numbers</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt>Brand</dt>
            <dd className="break-all">
              {r?.brand_id ?? "Not submitted"} · {r?.brand_status || "Draft"}
            </dd>
            <dt>Campaign</dt>
            <dd className="break-all">
              {r?.campaign_id ?? "Not submitted"} · {r?.campaign_status || "Draft"}
            </dd>
            <dt>Submitted</dt>
            <dd>{r?.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</dd>
          </dl>
          {r?.brand_id && b.entityType === "SOLE_PROPRIETOR" && !brandVerified(r.brand_status) && (
            <div className="space-y-3 border-y py-4">
              <h3 className="font-semibold">Sole-proprietor identity verification</h3>
              <p className="text-sm">Delivery: {data.otp?.deliveryStatus ?? "Not requested"}</p>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => run({ action: "otpSend", authorized: true })}
              >
                Send verification code
              </Button>
              <Field label="Verification PIN" value={pin} onChange={setPin} />
              <Button
                disabled={busy || !/^\d{4,10}$/.test(pin)}
                onClick={async () => {
                  await run({ action: "otpVerify", pin });
                  setPin("");
                }}
              >
                Verify identity
              </Button>
            </div>
          )}
          <h3 className="font-semibold">Your phone numbers</h3>
          {!data.numbers.length && (
            <p className="text-sm text-muted-foreground">No numbers assigned to your account.</p>
          )}
          <ul className="divide-y">
            {data.numbers.map((n) => {
              const link = data.links.find((l) => l.phone_number === n.phone_number);
              return (
                <li
                  key={n.phone_number}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-mono">{n.phone_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {link?.status === "PENDING_ASSIGNMENT"
                        ? "Number Association Pending"
                        : (link?.status ?? "Not associated")}
                      {link && ` · Campaign ${link.campaign_id}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      busy ||
                      !campaignApproved(r?.campaign_status ?? "") ||
                      r?.suspended ||
                      link?.status === "ASSIGNED"
                    }
                    onClick={() => run({ action: "assign", phone: n.phone_number })}
                  >
                    Associate number
                  </Button>
                </li>
              );
            })}
          </ul>
          <Link to="/numbers" className="text-sm font-semibold text-primary underline">
            Manage phone numbers
          </Link>
          <p className="text-sm text-muted-foreground">
            Voice calling remains available independently. SMS requires verified identity, carrier
            provisioning and a confirmed number association.
          </p>
          {data.operations.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-semibold">Submission history</h3>
              {data.operations.map((o) => (
                <div key={o.kind} className="text-sm">
                  <p>
                    {o.kind} · {o.state} · {new Date(o.authorized_at).toLocaleString()}
                  </p>
                  {o.detail && <p className="text-danger">{o.detail}</p>}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Rejected or uncertain submissions are never retried automatically. Provider-approved
                corrections and reconciliations require administrator assistance.
              </p>
            </div>
          )}
        </section>
      )}
      {step === 4 && <A2pAppeal status={r?.campaign_status ?? ""} />}
      <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
        <Button variant="outline" disabled={busy || !!r?.campaign_id} onClick={save}>
          <Save />
          {busy ? "Working…" : dirty ? "Save changes" : "Save draft"}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft /> Back
          </Button>
          <Button disabled={step === 4} onClick={next}>
            Continue <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function A2pCompliance() {
  const { isAdmin } = useDesk();
  const get = useServerFn(adminA2p),
    change = useServerFn(changeA2p),
    qc = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["a2p-admin"],
    queryFn: () => get(),
    enabled: isAdmin,
  });
  const [brand, setBrand] = useState(""),
    [review, setReview] = useState(""),
    [source, setSource] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false);
  if (!isAdmin) return null;
  const run = async (action: A2pAction) => {
    setBusy(true);
    try {
      const r = await change({ data: action });
      if (r.ok) {
        toast.success(r.message);
        qc.invalidateQueries({ queryKey: ["a2p-admin"] });
      } else toast.error(r.message);
    } catch {
      toast.error("Could not update compliance settings.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="A2P Compliance">
      <div className="space-y-5">
        {error && <p className="text-danger">Compliance records could not be loaded.</p>}
        <div className="flex flex-wrap justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {data?.registrations.length ?? 0} legal business registrations
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => qc.invalidateQueries({ queryKey: ["a2p-admin"] })}
          >
            <RefreshCw /> Refresh
          </Button>
        </div>
        {data?.registrations.map((r) => (
          <div key={r.id} className="space-y-2 border-t pt-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-semibold">{r.display_name || "Untitled business"}</p>
                <p className="text-sm">
                  {stageLabel(r)} · {r.relationship}
                </p>
              </div>
              <Button
                size="sm"
                variant={r.suspended ? "outline" : "destructive"}
                disabled={busy}
                onClick={() => run({ action: "suspend", id: r.id, suspended: !r.suspended })}
              >
                {r.suspended ? "Restore messaging" : "Suspend messaging"}
              </Button>
            </div>
            <p className="break-all text-xs text-muted-foreground">
              Brand {r.brand_id ?? "—"} · Campaign {r.campaign_id ?? "—"}
            </p>
            {r.blocker && <p className="text-sm text-danger">{r.blocker}</p>}
            {data.operations
              .filter((o) => o.registration_id === r.id)
              .map((o) => (
                <p key={o.kind} className="text-xs">
                  {o.kind}: {o.state}
                  {o.fee_snapshot && ` · Fees ${JSON.stringify(o.fee_snapshot)}`}
                </p>
              ))}
            {data.links
              .filter((n) => n.registration_id === r.id)
              .map((n) => (
                <p key={n.phone_number} className="font-mono text-xs">
                  {n.phone_number} · {n.status}
                </p>
              ))}
          </div>
        ))}
        <div className="space-y-4 border-t pt-5">
          <h3 className="font-semibold">Confirm Telnyx brand & review charges</h3>
          <p className="text-sm text-muted-foreground">
            Enter charges confirmed for this Telnyx account, with a billing-document or support
            reference. Confirmation expires after 30 days. Campaign use-case costs are retrieved
            directly from Telnyx.
          </p>
          {data?.fees && (
            <p className="text-sm">
              Current: ${Number(data.fees.brand_fee).toFixed(2)} brand · $
              {Number(data.fees.campaign_review_fee).toFixed(2)} review
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Confirmed brand fee (USD)"
              type="number"
              value={brand}
              onChange={setBrand}
            />
            <Field
              label="Confirmed campaign review fee (USD)"
              type="number"
              value={review}
              onChange={setReview}
            />
          </div>
          <Field
            label="Telnyx billing reference / confirmation source"
            value={source}
            onChange={setSource}
          />
          <Tick
            label="I verified these current account charges with Telnyx."
            value={confirmed}
            onChange={setConfirmed}
          />
          <Button
            disabled={busy || !confirmed || !brand || !review || source.length < 10}
            onClick={() =>
              run({ action: "fees", brand: Number(brand), review: Number(review), source })
            }
          >
            Confirm fee schedule
          </Button>
        </div>
      </div>
    </Panel>
  );
}
