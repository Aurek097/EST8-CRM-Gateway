import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicConsent, submitInquiry } from "@/lib/agency-a2p.functions";
import { consentDisclosure, DISCLOSURE_VERSION } from "@/lib/agency-a2p-rules";
import { Est8Mark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
export const Route = createFileRoute("/sms-consent")({
  head: () => ({
    meta: [
      { title: "Insurance Inquiry & SMS Consent · EST8 Financial Group" },
      {
        name: "description",
        content:
          "Request insurance information and choose optional insurance text updates from EST8 Financial Group.",
      },
      { property: "og:title", content: "Insurance Inquiry · EST8 Financial Group" },
      {
        property: "og:description",
        content: "Optional SMS choices for insurance inquiries and appointment updates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: () => getPublicConsent(),
  component: ConsentForm,
});
function ConsentForm() {
  const config = Route.useLoaderData(),
    send = useServerFn(submitInquiry);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [transactional, setTransactional] = useState(false),
    [marketing, setMarketing] = useState(false),
    [website, setWebsite] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [id, setId] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const requestId = id ?? crypto.randomUUID();
    setId(requestId);
    setBusy(true);
    try {
      const r = await send({
        data: {
          name,
          email,
          phone,
          transactional,
          marketing,
          requestId,
          version: DISCLOSURE_VERSION,
          website,
        },
      });
      setMessage(r.message);
    } catch {
      setMessage("Check your name, email and phone number (+1 followed by 10 digits).");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main
      className="mx-auto max-w-2xl space-y-7 px-5 py-10"
      data-consent-version={DISCLOSURE_VERSION}
    >
      <Est8Mark />
      <h1 className="text-3xl font-bold text-primary">EST8 Financial Group</h1>
      <h2 className="text-xl font-semibold">Insurance inquiry & SMS consent</h2>
      {!config ? (
        <p role="status">
          This inquiry form is awaiting verified agency contact details and privacy disclosures.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="consumer-name">Name</Label>
            <Input
              id="consumer-name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="consumer-email">Email</Label>
            <Input
              id="consumer-email"
              type="email"
              required
              maxLength={100}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="consumer-phone">Phone (+1…)</Label>
            <Input
              id="consumer-phone"
              type="tel"
              required
              pattern="\+1[0-9]{10}"
              maxLength={12}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="hidden" aria-hidden="true">
            <Input tabIndex={-1} value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div className="flex items-start gap-3 border-t pt-5">
            <Checkbox
              id="transactional-consent"
              checked={transactional}
              onCheckedChange={(v) => setTransactional(v === true)}
            />
            <Label htmlFor="transactional-consent" className="text-sm font-normal leading-relaxed">
              {consentDisclosure(config.sender, config.privacy, config.terms)}
            </Label>
          </div>
          {config.marketing && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="marketing-consent"
                checked={marketing}
                onCheckedChange={(v) => setMarketing(v === true)}
              />
              <Label htmlFor="marketing-consent" className="text-sm font-normal leading-relaxed">
                {consentDisclosure(config.sender, config.privacy, config.terms, true)}
              </Label>
            </div>
          )}
          <div className="flex gap-5 text-sm">
            <a
              className="text-primary underline"
              href={config.privacy}
              target="_blank"
              rel="noreferrer"
            >
              Privacy Policy
            </a>
            <a
              className="text-primary underline"
              href={config.terms}
              target="_blank"
              rel="noreferrer"
            >
              Terms of Service
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            You can submit an inquiry without consenting to text messages.
          </p>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Submit inquiry"}
          </Button>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
