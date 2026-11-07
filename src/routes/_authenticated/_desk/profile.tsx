import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Copy, Eye, EyeOff, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDesk, initials } from "@/lib/desk";
import { cn } from "@/lib/utils";
import { US_STATES } from "@/lib/leads";
import {
  AGENT_ROLES,
  DEFAULT_AGENCY,
  STANDARD_CARRIERS,
  licensedStatesOf,
  profileAlerts,
  readProfile,
  type AgentProfileData,
  type License,
  type WritingNumber,
  type WritingStatus,
} from "@/lib/profile";
import { PageHeader, Panel } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/_desk/profile")({
  head: () => ({
    meta: [
      { title: "Profile · EST8 CallDesk" },
      {
        name: "description",
        content: "Agent contact details, NPN, licenses and carrier writing numbers.",
      },
      { property: "og:title", content: "Profile · EST8 CallDesk" },
      {
        property: "og:description",
        content: "Agent contact details, NPN, licenses and carrier writing numbers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

const copy = (v: string, what: string) => {
  navigator.clipboard.writeText(v);
  toast.success(`${what} copied`);
};

/** Resize to 480 px max and return a JPEG data URL (stored on the profile, no file bucket needed). */
async function resizePhoto(file: File): Promise<string> {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  const scale = Math.min(1, 480 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return c.toDataURL("image/jpeg", 0.85);
}

const STARTER_CARRIERS = [
  "American General",
  "Americo",
  "Banner Life (BeyondTerm)",
  "Fidelity and Guaranty",
  "Legal & General America",
  "Liberty Bankers",
  "Mutual of Omaha",
  "Occidental",
  "SBLI",
  "SBLI",
  "Transamerica",
  "United Home Life",
];

function Profile() {
  const { me } = useDesk();
  const qc = useQueryClient();
  const [top, setTop] = useState({
    full_name: me.full_name ?? "",
    phone: me.phone ?? "",
    npn: me.npn ?? "",
    avatar_url: me.avatar_url ?? "",
  });
  const [p, setP] = useState<AgentProfileData>(() => {
    const x = readProfile(me.profile);
    // States typed before license rows existed become rows, so saving never drops them.
    if (!x.licenses?.length && me.licensed_states?.length)
      x.licenses = me.licensed_states.map((s) => ({
        state: s,
        number: "",
        expires: "",
        resident: false,
      }));
    return x;
  });
  const [saving, setSaving] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<AgentProfileData>) => setP((x) => ({ ...x, ...patch }));

  const alerts = profileAlerts(p);
  const states = licensedStatesOf(p);
  const resident = (p.licenses ?? []).find((l) => l.resident)?.state;
  const appointed = (p.writingNumbers ?? []).filter((w) => w.status === "Appointed").length;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: top.full_name || null,
        phone: top.phone || null,
        npn: top.npn || null,
        avatar_url: top.avatar_url || null,
        licensed_states: states,
        profile: p as never,
      })
      .eq("id", me.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save. Try again.");
      return;
    }
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["access"] });
  };

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      setTop((t) => ({ ...t, avatar_url: "" }));
      const url = await resizePhoto(f);
      setTop((t) => ({ ...t, avatar_url: url }));
      toast.success("Photo ready. Save to keep it.");
    } catch {
      toast.error("Couldn't read that image.");
    }
  };

  const loadStarter = () => {
    set({
      agency: p.agency || DEFAULT_AGENCY,
      quoteMp: p.quoteMp || "https://20009a4c1a8eb5e9.quoteplicity.com/quote/no-exam",
      licenses: p.licenses?.length
        ? p.licenses
        : ["MI", "OH", "SC", "TX", "VA"].map((s) => ({
            state: s,
            number: "",
            expires: "",
            resident: s === "TX",
          })),
      writingNumbers: p.writingNumbers?.length
        ? p.writingNumbers
        : STARTER_CARRIERS.map((c) => ({
            carrier: c,
            number: "",
            status: (c.startsWith("Legal") ? "Inactive" : "Appointed") as WritingStatus,
          })),
      amlProvider: p.amlProvider || "SuranceBay",
      eoCarrier: p.eoCarrier || "Next Insurance",
    });
    toast.success("Starter list added. Fill in the numbers and dates, then save.");
  };

  const lic = p.licenses ?? [];
  const setLic = (i: number, patch: Partial<License>) =>
    set({
      licenses: lic.map((l, j) =>
        j === i ? { ...l, ...patch } : patch.resident ? { ...l, resident: false } : l,
      ),
    });
  const wn = p.writingNumbers ?? [];
  const setWn = (i: number, patch: Partial<WritingNumber>) =>
    set({ writingNumbers: wn.map((w, j) => (j === i ? { ...w, ...patch } : w)) });

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6 pb-24">
      <PageHeader eyebrow="Agent" title="Profile">
        {!lic.length && !wn.length && (
          <Button variant="outline" onClick={loadStarter}>
            Load EST8 starter list
          </Button>
        )}
      </PageHeader>

      <Panel title="Alerts">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">All clear. Licenses and E&O are current.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                  a.tone === "bad" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning",
                )}
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {a.text}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Profile and photo">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-sky font-display text-2xl font-bold text-primary-foreground">
              {top.avatar_url ? (
                <img
                  src={top.avatar_url}
                  alt="Your photo"
                  className="size-full object-cover"
                  style={{ objectPosition: `${p.photoX ?? 50}% ${p.photoY ?? 50}%` }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                initials(top.full_name, me.email)
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPhoto(e.target.files?.[0])}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload /> Upload photo
            </Button>
            {top.avatar_url && (
              <Button size="sm" variant="ghost" onClick={() => setAdjust((a) => !a)}>
                Adjust position
              </Button>
            )}
            {adjust && (
              <div className="w-36 space-y-2 text-xs">
                <label className="block">
                  Left – right
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={p.photoX ?? 50}
                    onChange={(e) => set({ photoX: Number(e.target.value) })}
                    className="w-full"
                  />
                </label>
                <label className="block">
                  Up – down
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={p.photoY ?? 50}
                    onChange={(e) => set({ photoY: Number(e.target.value) })}
                    className="w-full"
                  />
                </label>
              </div>
            )}
          </div>
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <Field
              id="pf-name"
              label="Display name"
              value={top.full_name}
              onChange={(v) => setTop({ ...top, full_name: v })}
            />
            <div className="space-y-1.5">
              <Label htmlFor="pf-role">Role</Label>
              <select
                id="pf-role"
                value={p.role ?? "Agent"}
                onChange={(e) => set({ role: e.target.value })}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {AGENT_ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <Field
              id="pf-phone"
              label="Phone (licensing support only, never public)"
              mono
              value={top.phone}
              onChange={(v) => setTop({ ...top, phone: v })}
            />
            <div className="space-y-1.5">
              <Label htmlFor="pf-email">Email</Label>
              <Input id="pf-email" value={me.email} disabled className="font-mono" />
            </div>
            <Field
              id="pf-book"
              label="Booking / calendar link"
              value={p.bookingLink ?? ""}
              onChange={(v) => set({ bookingLink: v })}
            />
            <Field
              id="pf-imo"
              label="IMO / agency"
              value={p.imo ?? ""}
              onChange={(v) => set({ imo: v })}
            />
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="On your calls">
          <div className="space-y-4">
            <Field
              id="pf-agency"
              label="Agency name said on calls"
              value={p.agency ?? ""}
              placeholder={DEFAULT_AGENCY}
              onChange={(v) => set({ agency: v })}
            />
            <Field
              id="pf-callback"
              label="Callback number you give clients"
              mono
              value={p.callbackPhone ?? ""}
              placeholder="(281) 635-4471"
              onChange={(v) => set({ callbackPhone: v })}
            />
            <p className="text-xs text-muted-foreground">
              Used in scripts, voicemails and texts. Leave blank to use your phone above.
            </p>
          </div>
        </Panel>
        <Panel title="Quoting">
          <div className="space-y-4">
            <Field
              id="pf-qmp"
              label="Mortgage protection quote link"
              mono
              value={p.quoteMp ?? ""}
              placeholder="https://….quoteplicity.com/quote/no-exam"
              onChange={(v) => set({ quoteMp: v })}
            />
            <Field
              id="pf-qfe"
              label="Final expense quote link"
              mono
              value={p.quoteFe ?? ""}
              placeholder="Copy from Quoteplicity Link Builder"
              onChange={(v) => set({ quoteFe: v })}
            />
            <div className="flex items-start gap-3">
              <Switch
                id="pf-send"
                checked={!!p.quoteSendContact}
                onCheckedChange={(c) => set({ quoteSendContact: c })}
              />
              <Label htmlFor="pf-send" className="font-normal leading-snug">
                Send lead name, email and phone
                <span className="block text-xs text-muted-foreground">
                  Off by default. It can create a lead in Quoteplicity's CRM and set off its
                  automations.
                </span>
              </Label>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Licensing">
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Chip>NPN {top.npn || "—"}</Chip>
          <Chip>Licensed: {states.join(", ") || "none"}</Chip>
          <Chip>Resident: {resident || "—"}</Chip>
          <Chip>{appointed} carriers appointed</Chip>
          <Chip>E&O through {p.eoExpires || "—"}</Chip>
        </div>
        <div className="mb-4 flex max-w-sm items-end gap-2">
          <div className="flex-1">
            <Field
              id="pf-npn"
              label="NPN"
              mono
              value={top.npn}
              onChange={(v) => setTop({ ...top, npn: v })}
            />
          </div>
          {top.npn && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Copy NPN"
              onClick={() => copy(top.npn, "NPN")}
            >
              <Copy />
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {lic.map((l, i) => (
            <div key={i} className="grid grid-cols-[5rem_1fr_9.5rem_auto_auto] items-center gap-2">
              <select
                aria-label="State"
                value={l.state}
                onChange={(e) => setLic(i, { state: e.target.value })}
                className="h-9 rounded-md border bg-background px-2 font-mono text-sm"
              >
                <option value="">—</option>
                {Object.keys(US_STATES).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <Input
                  aria-label="License number"
                  placeholder="License #"
                  value={l.number}
                  onChange={(e) => setLic(i, { number: e.target.value })}
                  className="font-mono"
                />
                {l.number && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Copy license number"
                    onClick={() => copy(l.number, "License number")}
                  >
                    <Copy />
                  </Button>
                )}
              </div>
              <Input
                aria-label="Expiration date"
                type="date"
                value={l.expires}
                onChange={(e) => setLic(i, { expires: e.target.value })}
              />
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={l.resident} onCheckedChange={(c) => setLic(i, { resident: c })} />
                {l.resident ? "Resident" : "Non-res."}
              </label>
              <RemoveBtn onConfirm={() => set({ licenses: lic.filter((_, j) => j !== i) })} />
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() =>
            set({ licenses: [...lic, { state: "", number: "", expires: "", resident: false }] })
          }
        >
          <Plus /> Add state
        </Button>
      </Panel>

      <Panel title="Carrier writing numbers">
        <datalist id="pf-carriers">
          {STANDARD_CARRIERS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="space-y-2">
          {wn.map((w, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_8rem_auto] items-center gap-2">
              <Input
                aria-label="Carrier"
                list="pf-carriers"
                placeholder="Carrier"
                value={w.carrier}
                onChange={(e) => setWn(i, { carrier: e.target.value })}
              />
              <div className="flex items-center gap-1">
                <Input
                  aria-label="Writing number"
                  placeholder="Writing #"
                  value={w.number}
                  onChange={(e) => setWn(i, { number: e.target.value })}
                  className="font-mono"
                />
                {w.number && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Copy writing number"
                    onClick={() => copy(w.number, "Writing number")}
                  >
                    <Copy />
                  </Button>
                )}
              </div>
              <select
                aria-label="Status"
                value={w.status}
                onChange={(e) => setWn(i, { status: e.target.value as WritingStatus })}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                {["Appointed", "Pending", "Inactive"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <RemoveBtn onConfirm={() => set({ writingNumbers: wn.filter((_, j) => j !== i) })} />
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() =>
            set({ writingNumbers: [...wn, { carrier: "", number: "", status: "Appointed" }] })
          }
        >
          <Plus /> Add carrier
        </Button>
      </Panel>

      <Panel title="Additional info">
        <PrivateInfo />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field
            id="pf-aml"
            label="AML provider"
            value={p.amlProvider ?? ""}
            onChange={(v) => set({ amlProvider: v })}
          />
          <Field
            id="pf-amld"
            label="AML course completed"
            type="date"
            value={p.amlDate ?? ""}
            onChange={(v) => set({ amlDate: v })}
          />
          <Field
            id="pf-eoc"
            label="E&O carrier"
            value={p.eoCarrier ?? ""}
            onChange={(v) => set({ eoCarrier: v })}
          />
          <Field
            id="pf-eop"
            label="E&O policy number"
            mono
            value={p.eoPolicy ?? ""}
            onChange={(v) => set({ eoPolicy: v })}
          />
          <Field
            id="pf-eocert"
            label="E&O certificate number"
            mono
            value={p.eoCert ?? ""}
            onChange={(v) => set({ eoCert: v })}
          />
          <Field
            id="pf-eoe"
            label="E&O expiration date"
            type="date"
            value={p.eoExpires ?? ""}
            onChange={(v) => set({ eoExpires: v })}
          />
        </div>
      </Panel>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl justify-end p-3 px-6">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** DOB and driver's license: own table, visible only to this agent, masked by default, saved on its own. */
function PrivateInfo() {
  const { me } = useDesk();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["agent-private", me.id],
    queryFn: async () =>
      (await supabase.from("agent_private").select("*").eq("user_id", me.id).maybeSingle()).data,
  });
  const [f, setF] = useState({ dob: "", dl_number: "", dl_state: "" });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data)
      setF({ dob: data.dob ?? "", dl_number: data.dl_number ?? "", dl_state: data.dl_state ?? "" });
  }, [data]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("agent_private").upsert({
      user_id: me.id,
      dob: f.dob || null,
      dl_number: f.dl_number || null,
      dl_state: f.dl_state || null,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save. Try again.");
      return;
    }
    toast.success("Private details saved");
    qc.invalidateQueries({ queryKey: ["agent-private", me.id] });
  };
  if (isLoading) return null;
  return (
    <div className="rounded-lg border border-dashed p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Only you can see these. They're never shared with your admin or any other service.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="pf-dob"
          label="Date of birth"
          type={show ? "date" : "password"}
          value={f.dob}
          onChange={(v) => setF({ ...f, dob: v })}
        />
        <Field
          id="pf-dl"
          label="Driver's license number"
          mono
          type={show ? "text" : "password"}
          value={f.dl_number}
          onChange={(v) => setF({ ...f, dl_number: v })}
        />
        <div className="space-y-1.5">
          <Label htmlFor="pf-dls">License state</Label>
          <select
            id="pf-dls"
            value={f.dl_state}
            onChange={(e) => setF({ ...f, dl_state: e.target.value })}
            className="h-9 w-full rounded-md border bg-background px-2 font-mono text-sm"
          >
            <option value="">—</option>
            {Object.keys(US_STATES).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setShow((s) => !s)}>
          {show ? (
            <>
              <EyeOff /> Hide
            </>
          ) : (
            <>
              <Eye /> Show
            </>
          )}
        </Button>
        <Button size="sm" variant="outline" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save private details"}
        </Button>
      </div>
    </div>
  );
}

function RemoveBtn({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <Button size="sm" variant="destructive" onClick={onConfirm}>
      Remove?
    </Button>
  ) : (
    <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setArmed(true)}>
      <Trash2 />
    </Button>
  );
}

const Chip = ({ children }: { children: ReactNode }) => (
  <span className="rounded-full bg-muted px-2.5 py-1 font-mono">{children}</span>
);

function Field({
  id,
  label,
  value,
  onChange,
  mono,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? "font-mono" : undefined}
      />
    </div>
  );
}
