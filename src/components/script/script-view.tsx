import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, Pencil, Copy, PhoneOff, Voicemail, MessageSquare, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useDesk } from "@/lib/desk";
import { buildQuoteUrl, carrierSuggestions, readProfile, writingNumbersFor } from "@/lib/profile";
import { quoteParams } from "@/scripts/engine";
import { useWeekStats } from "@/lib/week-stats";
import { fieldPatch, money, stateCode, US_STATES, type LeadRow } from "@/lib/leads";
import { stagePatch, verifyFix, verifyToggle } from "@/lib/lead-mutations";
import type { Block, Field, Script, Section } from "@/scripts/types";
import { mpStep1 } from "@/scripts/mp-step1";
import { DELIVERY, mpStep2 } from "@/scripts/mp-step2";
import { feScript } from "@/scripts/fe";
import {
  EMPTY_OK,
  FE_DEFAULT_COVS,
  FE_LABELS,
  HQ,
  age,
  cashflow,
  feHealth,
  fieldKey,
  isMarried,
  leadHours,
  localTime,
  mpPlan,
  opener,
  parseHW,
  road,
  show,
  token,
  usd,
  val,
  type Ctx,
} from "@/scripts/engine";

export function scriptFor(l: LeadRow): Script {
  if (l.lead_type === "fe") return feScript;
  return l.step === 2 ? mpStep2 : mpStep1;
}

type Api = {
  ctx: Ctx;
  set: (key: string, value: string) => void;
  patch: (p: Partial<LeadRow>) => void;
  outcome: (o: "noanswer" | "voicemail" | "text" | "talked") => void;
};

/* ---------- token text ---------- */

export function Rich({ text, api }: { text: string; api: Api }) {
  const parts = text.split(/(\{\{\w+\}\}|\[\[v:\w+\]\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const tk = p.match(/^\{\{(\w+)\}\}$/);
        if (tk) {
          const v = token(tk[1]!, api.ctx);
          if (v === "" && EMPTY_OK.has(tk[1]!)) return null;
          if (v == null || v === "")
            return (
              <span key={i} className="italic text-warning">
                [{tk[1]}]
              </span>
            );
          return (
            <span key={i} className="rounded bg-fill px-1 text-fill-foreground">
              {v}
            </span>
          );
        }
        const vc = p.match(/^\[\[v:(\w+)\]\]$/);
        if (vc) return <VerifyChip key={i} field={fieldKey(vc[1]!)} api={api} />;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

export function plainText(text: string, ctx: Ctx) {
  return text
    .replace(/\{\{(\w+)\}\}/g, (_, t) => token(t, ctx) ?? `[${t}]`)
    .replace(/\[\[v:(\w+)\]\]/g, (_, k) => val(ctx.lead, fieldKey(k)) ?? `[${k}]`);
}

function VerifyChip({ field, api }: { field: string; api: Api }) {
  const l = api.ctx.lead;
  const status = ((l.verify ?? {}) as Record<string, string>)[field];
  const orig = ((l.orig ?? {}) as Record<string, string>)[field];
  let value = field === "age" ? (age(l, api.ctx.now)?.toString() ?? null) : val(l, field);
  if (field === "loanAmount" && value) value = usd(money(value)) ?? value;
  if (field === "state" && value) value = US_STATES[stateCode(value) ?? ""] ?? value;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const save = () => {
    setEditing(false);
    if (draft !== (val(l, field) ?? "")) api.patch(verifyFix(l, field, draft, val(l, field) ?? ""));
  };
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && save()}
        className="mx-0.5 w-40 rounded border-2 border-sky bg-card px-1 align-baseline text-[0.9em]"
      />
    );
  }
  return (
    <span
      className={cn(
        "mx-0.5 inline-flex items-baseline gap-1 rounded-md border px-1.5 align-baseline text-[0.92em]",
        status === "ok"
          ? "border-success bg-success-soft text-success"
          : status === "fixed"
            ? "border-warning bg-warning-soft"
            : "border-sky/60 bg-sky-soft text-primary",
      )}
      title={status === "fixed" && orig != null ? `Lead had: ${orig || "(blank)"}` : undefined}
    >
      <span className={cn(!value && "italic text-warning")}>{value || `[${field}]`}</span>
      <button
        aria-label="Verified"
        onClick={() => api.patch(verifyToggle(l, field))}
        className="self-center"
      >
        <Check className="size-3.5" />
      </button>
      <button
        aria-label="Fix"
        onClick={() => {
          setDraft(val(l, field) ?? "");
          setEditing(true);
        }}
        className="self-center text-muted-foreground"
      >
        <Pencil className="size-3" />
      </button>
    </span>
  );
}

/* ---------- inputs ---------- */

function FieldInput({ field, api }: { field: Field; api: Api }) {
  if (!show(field.showWhen, api.ctx)) return null;
  const value = val(api.ctx.lead, fieldKey(field.key)) ?? "";
  const label = (
    <span className="text-[11px] font-semibold text-muted-foreground">
      <Rich text={field.label} api={api} />
    </span>
  );
  const set = (v: string) => api.set(fieldKey(field.key), v);

  if (field.kind === "seg") {
    return (
      <div className="space-y-1">
        {label}
        <div className="flex flex-wrap gap-1">
          {field.options!.map((o) => {
            const on = value === o;
            const tone =
              field.yesNo && on
                ? o === "Yes"
                  ? "bg-danger text-primary-foreground"
                  : "bg-success text-primary-foreground"
                : on
                  ? "bg-sky text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-accent";
            return (
              <button
                key={o}
                onClick={() => set(on ? "" : o)}
                className={cn("rounded-full px-3 py-1 text-sm font-semibold transition", tone)}
              >
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  const common = {
    value,
    placeholder: field.placeholder,
    onChange: (e: { target: { value: string } }) => set(e.target.value),
  };
  return (
    <label className={cn("block space-y-1", field.kind === "area" && "sm:col-span-2")}>
      {label}
      {field.kind === "area" ? (
        <Textarea rows={2} {...common} />
      ) : (
        <Input
          {...common}
          type={
            field.kind === "date" ? "date" : field.kind === "datetime" ? "datetime-local" : "text"
          }
          inputMode={field.kind === "money" ? "decimal" : undefined}
          list={field.kind === "carrier" ? "carrier-list" : undefined}
          className={cn(field.kind === "money" && "font-mono", value && "border-sky")}
        />
      )}
    </label>
  );
}

function FieldGrid({ fields, api }: { fields: Field[]; api: Api }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <FieldInput key={f.key} field={f} api={api} />
      ))}
    </div>
  );
}

/* ---------- calculated boxes ---------- */

function Box({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "ok" | "bad" | "warn";
}) {
  const t = {
    info: "border-sky/40 bg-sky-soft",
    ok: "border-success/40 bg-success-soft",
    bad: "border-danger/40 bg-danger-soft",
    warn: "border-warning/40 bg-warning-soft",
  }[tone];
  return <div className={cn("rounded-lg border p-3 text-sm", t)}>{children}</div>;
}
const Row = ({ k, v, bad }: { k: string; v: ReactNode; bad?: boolean }) => (
  <div className="flex justify-between gap-3 border-b border-border/50 py-1 last:border-0">
    <span className="text-muted-foreground">{k}</span>
    <span className={cn("font-mono", bad && "text-danger font-semibold")}>{v}</span>
  </div>
);
const Spoken = ({ children }: { children: ReactNode }) => (
  <p className="max-w-[66ch] text-[17px] leading-relaxed md:text-[19px]">{children}</p>
);

function Calc({ id, api }: { id: string; api: Api }) {
  const { lead: l, me, now } = api.ctx;
  const { bookUserId } = useDesk();
  const { data: wk } = useWeekStats(bookUserId);
  const first = val(l, "first_name") ?? "[first]";
  const spouse = val(l, "spouseName") ?? "[spouse]";
  const ben = val(l, "beneficiary") ?? "[beneficiary]";
  const prof = readProfile(me.profile);

  switch (id) {
    case "weeklyGoals": {
      const bar = (n: number, goal: number, label: string) => (
        <div>
          <div className="flex justify-between text-xs">
            <span>{label}</span>
            <span className="font-mono">
              {n}/{goal}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${Math.min(100, (n / goal) * 100)}%` }}
            />
          </div>
        </div>
      );
      return (
        <Box>
          <div className="grid gap-3 sm:grid-cols-3">
            {bar(wk?.dials ?? 0, 500, "Dials this week")}
            {bar(wk?.appts ?? 0, 20, "Appointments")}
            <div className="text-xs">
              Dials to this lead <p className="font-mono text-lg">{l.dials}</p>
            </div>
          </div>
        </Box>
      );
    }
    case "funnelDates": {
      const d = (n: number) => {
        const x = new Date(now);
        x.setDate(x.getDate() + n);
        return x.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      };
      const iso = (n: number) => {
        const x = new Date(now);
        x.setDate(x.getDate() + n);
        return x.toISOString().slice(0, 10);
      };
      return (
        <Box>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => api.set("apptDay", iso(0))}>
              Today · {d(0)}
            </Button>
            <Button size="sm" variant="outline" onClick={() => api.set("apptDay", iso(1))}>
              Tomorrow · {d(1)}
            </Button>
            <span className="self-center text-xs text-muted-foreground">48-hour limit: {d(2)}</span>
          </div>
        </Box>
      );
    }
    case "phoneSaid":
      return (
        <Box>
          <p className="eyebrow mb-1">On the phone they said</p>
          <Row k="Main concern" v={val(l, "mainConcern") ?? "—"} />
          <Row k="Goal" v={val(l, "goal") ?? "—"} />
        </Box>
      );
    case "billsLine": {
      const b = (money(val(l, "monthlyPayment")) ?? 0) + (money(val(l, "otherBills")) ?? 0);
      return (
        <Spoken>
          "When we add this up, it looks like about{" "}
          <Rich text={b ? usd(b)! : "{{bills}}"} api={api} /> comes out for the bills every month.
          Does that seem about right?"
        </Spoken>
      );
    }
    case "incomeLine": {
      const c = cashflow(l);
      return (
        <Spoken>
          "So, it looks like approximately{" "}
          <Rich text={c.income ? usd(c.income)! : "{{income}}"} api={api} /> is coming into the
          house every month, correct?"
        </Spoken>
      );
    }
    case "cashflowTable": {
      const c = cashflow(l);
      const neg = (n: number) => (
        <span className={cn(n < 0 && "text-danger font-semibold")}>{usd(n)}</span>
      );
      return (
        <div className="space-y-3">
          <Box>
            <Row k="Combined monthly income" v={usd(c.income)} />
            <Row k="Approximate household expenses" v={usd(c.bills)} />
            <Row k="Extra each month" v={usd(c.extra)} bad={c.extra < 0} />
          </Box>
          <Spoken>
            "Based on the information you gave me, it looks like we have about {neg(c.extra)} in
            extra income per month. Does that sound right to you?"
          </Spoken>
          {c.married ? (
            <Spoken>
              "Without {first}'s income, it looks like you would be left, {spouse}, with{" "}
              {neg(c.withoutA)}. And without {spouse}'s income, it looks like you would be left,{" "}
              {first}, with {neg(c.withoutB)}. Is that what you guys see?"
            </Spoken>
          ) : (
            <Spoken>
              "Without your income, {first}, it looks like {ben} would be left with{" "}
              {neg(c.withoutA)} a month."
            </Spoken>
          )}
        </div>
      );
    }
    case "road": {
      const r = road(l, now);
      const label = {
        full: "Full or partial payoff",
        partialcp: "Partial payoff or Critical Period",
        cp: "Critical Period",
      }[r.road];
      return (
        <Box tone="info">
          <p className="eyebrow">Suggested road</p>
          <p className="font-display text-lg font-bold text-primary">{label}</p>
          <p className="text-muted-foreground">{r.reason}</p>
        </Box>
      );
    }
    case "quoteSheet": {
      const hw = parseHW(val(l, "hwA"));
      const rows: [string, string | null][] =
        l.lead_type === "fe"
          ? [
              ["State", val(l, "state")],
              ["Age", age(l, now)?.toString() ?? null],
              ["DOB", val(l, "dob")],
              ["Gender", val(l, "gender")],
              [
                "Height / weight",
                hw ? `${hw.feet}'${hw.inches}" · ${hw.pounds} lb` : val(l, "hwA"),
              ],
              ["Tobacco", val(l, "tobacco")],
              ["Meds", val(l, "meds")],
              ["Flags", `${feHealth(l).n} of 8`],
              ["Budget", token("budget", api.ctx)],
              ["Requested", val(l, "amountRequested")],
            ]
          : [
              ["State", val(l, "state")],
              ["Age", age(l, now)?.toString() ?? null],
              ["DOB", val(l, "dob")],
              ["Tobacco", val(l, "tobacco")],
              [
                "Height / weight",
                hw ? `${hw.feet}'${hw.inches}" · ${hw.pounds} lb` : val(l, "hwA"),
              ],
              ["Health", val(l, "health")],
              ["Meds", val(l, "meds")],
              ["History", val(l, "history")],
              ["Spouse", isMarried(l) ? spouse : "Single"],
              ["Loan", token("loan", api.ctx)],
              ["Payment", token("payment", api.ctx)],
              ["Program", val(l, "program")],
            ];
      const text = rows.map(([k, v]) => `${k}: ${v ?? "—"}`).join("\n");
      return (
        <Box>
          <div className="mb-1 flex items-center justify-between">
            <p className="eyebrow">Quote sheet</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(text);
                toast.success("Quote sheet copied");
              }}
            >
              <Copy /> Copy quote sheet
            </Button>
          </div>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <Row key={k} k={k} v={v ?? "—"} />
            ))}
          </div>
        </Box>
      );
    }
    case "anchor": {
      const p = mpPlan(l);
      if (p.kind === "cp")
        return (
          <Box>
            <p className="eyebrow">Critical period</p>
            <p>
              Months they say ±3 × monthly payment ({token("payment", api.ctx) ?? "[payment]"}).
            </p>
          </Box>
        );
      return (
        <Box>
          <p className="eyebrow">10% rule</p>
          <p>
            Anchor premium:{" "}
            <span className="font-mono font-semibold">
              {p.anchor ? usd(p.anchor) : "[payment]"}/mo
            </span>{" "}
            (10% of the mortgage payment). Show options above, at and below it; the middle should
            land near $80–$100 a month.
          </p>
        </Box>
      );
    }
    case "writingNumber": {
      const carrier = val(l, "carrier");
      if (!carrier) return <Box tone="warn">Pick a carrier to see your writing number.</Box>;
      const wns = writingNumbersFor(prof, carrier);
      return wns.length ? (
        <Box tone="ok">
          {wns.map((w, i) => (
            <p key={i}>
              Writing number for {w.carrier}:{" "}
              <span className="font-mono font-semibold">{w.number}</span>
              {w.status === "Pending" && " (pending)"}
            </p>
          ))}
          <p>
            NPN <span className="font-mono">{me.npn ?? "—"}</span>
          </p>
        </Box>
      ) : (
        <Box tone="warn">
          No writing number for {carrier} in your Profile. Make sure you're appointed before you
          write it.
        </Box>
      );
    }
    case "quoteLink": {
      const fe = l.lead_type === "fe";
      const base = (fe ? prof.quoteFe : prof.quoteMp) || prof.quoteMp || "";
      const fellBack = fe && !prof.quoteFe && !!prof.quoteMp;
      const { params, missing } = quoteParams(l, now, !!prof.quoteSendContact);
      const url = base ? buildQuoteUrl(base, params) : null;
      const sent = Object.entries(params).filter(
        ([k, v]) =>
          v != null && v !== "" && k !== "results_modal_override" && k !== "skip_confirmation",
      );
      return (
        <Box tone={url ? "info" : "warn"}>
          <p className="eyebrow mb-1">Quoteplicity</p>
          {!base ? (
            <p>
              Add your {fe ? "final expense" : "mortgage protection"} quote link on the Profile page
              (Quoting card) to open a pre-filled quote.
            </p>
          ) : !url ? (
            <p>The saved quote link isn't a valid web address. Fix it on the Profile page.</p>
          ) : (
            <>
              {fellBack && (
                <p className="mb-1 text-xs">
                  No final expense link saved, so this uses your mortgage link.
                </p>
              )}
              <p className="text-xs">
                Sends:{" "}
                <span className="font-mono">
                  {sent.map(([k, v]) => `${k}=${v}`).join(" · ") || "nothing yet"}
                </span>
              </p>
              {missing.length > 0 && (
                <p className="mt-1 text-xs text-warning">Missing: {missing.join(", ")}</p>
              )}
              <Button size="sm" className="mt-2" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  Open pre-filled quote
                </a>
              </Button>
            </>
          )}
        </Box>
      );
    }
    case "delivery": {
      const carrier = val(l, "carrier");
      const d = DELIVERY.find(([c]) => carrier && c.toLowerCase() === carrier.toLowerCase());
      return d ? (
        <div className="space-y-1">
          <Spoken>"{d[1]}"</Spoken>
          {d[2] && <p className="text-xs text-muted-foreground">{d[2]}</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <tbody>
              {DELIVERY.map(([c, s, n]) => (
                <tr key={c} className="border-b">
                  <td className="py-1 pr-2 font-semibold">{c}</td>
                  <td className="py-1 pr-2">"{s}"</td>
                  <td className="py-1 text-muted-foreground">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "lockPrompts":
      return (
        <Box>
          <p className="eyebrow mb-1">Listen for</p>
          <Row k="Coverage" v={token("chosen", api.ctx) ?? "—"} />
          <Row k="Program" v={val(l, "program") ?? "—"} />
          <Row k="What it's for" v={val(l, "goal") ?? "—"} />
          <Row k="Beneficiary" v={val(l, "beneficiary") ?? "—"} />
          <p className="mt-1 text-xs text-muted-foreground">
            Also ask how soon the first payment drafts and why we chose this program.
          </p>
        </Box>
      );
    case "debtRet":
      return (
        <Box>
          <Row k="Total debt" v={token("debtTotal", api.ctx) ?? val(l, "debtTotal") ?? "—"} />
          <Row k="Retirement" v={val(l, "retirement") ?? "—"} />
        </Box>
      );
    case "compliance": {
      const code = stateCode(l.state);
      const licensed = !!code && (me.licensed_states ?? []).includes(code);
      const lic = token("licNum", api.ctx);
      const t = localTime(l.state, now);
      const o = opener(l, now);
      const h = leadHours(l, now);
      const dnc = l.status === "dnc";
      const allOk = licensed && !!t?.ok && !dnc;
      return (
        <Box tone={allOk ? "ok" : "bad"}>
          <p className="eyebrow mb-1">Compliance</p>
          <Row
            k="State"
            bad={!licensed}
            v={
              code
                ? licensed
                  ? `${US_STATES[code]} · licensed${lic ? ` · #${lic}` : ""}`
                  : `${US_STATES[code]}: not one of your licensed states. Do not quote or write.`
                : "State missing"
            }
          />
          <Row
            k="Client's local time"
            bad={!t?.ok}
            v={
              t
                ? t.ok
                  ? `${t.label} · inside 8 a.m.–9 p.m.`
                  : `${t.label} · Outside 8 a.m.–9 p.m. Wait to call.`
                : "Unknown"
            }
          />
          <Row
            k="Lead age"
            v={`${h < 48 ? `${Math.floor(h)} hours` : `${Math.floor(h / 24)} days`} → Opener ${o} · ${o === "A" ? "call within 5 minutes, then 3–5 attempts on day 1" : "1–2 attempts a day, rotating times"}`}
          />
          {dnc && <Row k="Do not call" bad v="Dialing and texting are blocked" />}
        </Box>
      );
    }
    case "hobby": {
      const h = val(l, "hobby");
      if (!h || /^none$/i.test(h) || h.toLowerCase() === (val(l, "first_name") ?? "").toLowerCase())
        return null;
      return (
        <Box>
          On the form, their favorite hobby is <b>{h}</b>. Work it in.
        </Box>
      );
    }
    case "feHealth": {
      const r = feHealth(l);
      return <Box tone={r.n ? "warn" : "ok"}>{r.text}</Box>;
    }
    case "feAnchor":
      return (
        <Box>
          Have them write the three numbers down. Top option at or slightly above budget, middle at
          budget, bottom below.{" "}
          <span className="font-mono">
            Budget {token("budget", api.ctx) ?? "—"} · requested {val(l, "amountRequested") ?? "—"}
          </span>
        </Box>
      );
    default:
      return null;
  }
}

/* ---------- blocks ---------- */

function OptionRows({ api }: { api: Api }) {
  const l = api.ctx.lead;
  const fe = l.lead_type === "fe";
  const plan = fe ? null : mpPlan(l);
  const labels = fe ? FE_LABELS : plan!.labels;
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="grid grid-cols-[110px_1fr_1fr] items-end gap-2">
          <span className="pb-2 text-sm font-semibold">
            {fe ? labels[i - 1] : `Option ${i}`}
            <span className="block text-[11px] font-normal text-muted-foreground">
              {fe ? "" : labels[i - 1]}
            </span>
          </span>
          <FieldInput
            api={api}
            field={{
              key: `optCov${i}`,
              label: "Coverage",
              kind: "money",
              placeholder: fe
                ? String(FE_DEFAULT_COVS[i - 1])
                : plan!.covs[i - 1]
                  ? String(Math.round(plan!.covs[i - 1]!))
                  : "",
            }}
          />
          <FieldInput
            api={api}
            field={{
              key: `optPrem${i}`,
              label: "Premium / month",
              kind: "money",
              placeholder:
                !fe && plan!.kind === "pct" && plan!.anchor
                  ? String(Math.round(plan!.anchor * [1.25, 1, 0.75][i - 1]!))
                  : "",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function HealthGridBlock({ api }: { api: Api }) {
  return (
    <div className="divide-y rounded-lg border">
      {HQ.map(([k, label]) => (
        <div key={k} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span>{label}</span>
          <FieldInput
            api={api}
            field={{ key: k, label: "", kind: "seg", options: ["Yes", "No"], yesNo: true }}
          />
        </div>
      ))}
    </div>
  );
}

function BlockView({ b, api, sectionId }: { b: Block; api: Api; sectionId: string }) {
  if (!show(b.showWhen, api.ctx)) return null;
  switch (b.t) {
    case "say":
      return (
        <Spoken>
          "<Rich text={b.text} api={api} />"
        </Spoken>
      );
    case "cue":
      return (
        <p className="max-w-[66ch] text-sm text-muted-foreground">
          <span className="mr-1.5 font-semibold uppercase tracking-wider text-[10px] text-slate">
            {b.label ?? "Cue"}
          </span>
          <Rich text={b.text} api={api} />
        </p>
      );
    case "rule":
      return (
        <p className="max-w-[66ch] text-sm">
          <span className="mr-1.5 rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger">
            Rule
          </span>
          <Rich text={b.text} api={api} />
        </p>
      );
    case "note":
      return (
        <div className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">
          <Rich text={b.text} api={api} />
        </div>
      );
    case "sub":
      return (
        <h4 className="pt-2 font-display text-base font-semibold text-primary">
          <Rich text={b.text} api={api} />
        </h4>
      );
    case "verifyLine":
      return (
        <p className="text-sm text-muted-foreground">
          <Rich text={b.text} api={api} />
        </p>
      );
    case "ask":
      return (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <p className="max-w-[66ch] text-[17px] leading-relaxed">
            {b.n != null && (
              <span className="mr-2 inline-flex min-w-6 justify-center rounded bg-primary px-1.5 font-display text-sm font-bold text-primary-foreground">
                {b.n}
              </span>
            )}
            <Rich text={b.q} api={api} />
          </p>
          {b.fields && b.fields.length > 0 && <FieldGrid fields={b.fields} api={api} />}
          {b.why && (
            <p className="text-xs text-muted-foreground">
              <span className="mr-1 font-semibold uppercase tracking-wider text-[10px] text-slate">
                Why
              </span>
              {b.why}
            </p>
          )}
        </div>
      );
    case "fields":
      return <FieldGrid fields={b.fields} api={api} />;
    case "list": {
      const chk = ((api.ctx.lead.data as Record<string, unknown>)?.["_chk"] ?? {}) as Record<
        string,
        boolean
      >;
      return (
        <div className="space-y-1">
          {b.label && <p className="eyebrow">{b.label}</p>}
          {b.items.map((it, i) => {
            const k = `${sectionId}.${b.id}.${i}`;
            return (
              <label key={k} className="flex cursor-pointer items-start gap-2 text-[15px]">
                <input
                  type="checkbox"
                  className="mt-1 accent-[var(--color-primary)]"
                  checked={!!chk[k]}
                  onChange={() =>
                    api.patch({
                      data: {
                        ...((api.ctx.lead.data ?? {}) as Record<string, unknown>),
                        _chk: { ...chk, [k]: !chk[k] },
                      } as LeadRow["data"],
                    })
                  }
                />
                <span className={cn(chk[k] && "text-muted-foreground line-through")}>
                  <Rich text={it} api={api} />
                </span>
              </label>
            );
          })}
        </div>
      );
    }
    case "calc":
      return <Calc id={b.id} api={api} />;
    case "action":
      return <ActionButton label={b.label} action={b.action} primary={!!b.primary} api={api} />;
    case "dialRow":
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="outline" onClick={() => api.outcome("noanswer")}>
            <PhoneOff /> No answer
          </Button>
          <Button variant="outline" onClick={() => api.outcome("voicemail")}>
            <Voicemail /> Left voicemail
          </Button>
          <Button variant="outline" onClick={() => api.outcome("text")}>
            <MessageSquare /> Sent text
          </Button>
          <Button variant="ember" onClick={() => api.outcome("talked")}>
            <PhoneCall /> Talked
          </Button>
        </div>
      );
    case "healthGrid":
      return <HealthGridBlock api={api} />;
    case "optionRows":
      return <OptionRows api={api} />;
    case "table":
      return null;
  }
}

function ActionButton({
  label,
  action,
  primary,
  api,
}: {
  label: string;
  action: string;
  primary: boolean;
  api: Api;
}) {
  const l = api.ctx.lead;
  const run = () => {
    switch (action) {
      case "goStep2":
        api.patch({ step: 2 });
        window.scrollTo({ top: 0, behavior: "smooth" });
        toast.success("Step 2: the presentation");
        return;
      case "apptSet":
        api.patch(stagePatch(l, "appointment"));
        toast.success("Appointment set");
        return;
      case "quoted":
        api.patch(stagePatch(l, "quoted"));
        toast.success("Marked quoted");
        return;
      case "appSubmitted":
        api.patch(stagePatch(l, "application"));
        toast.success("Application logged");
        return;
      case "markDnc":
        api.patch(stagePatch(l, "dnc"));
        toast.success("Marked Do not call");
        return;
    }
  };
  return (
    <Button variant={primary ? "ember" : "default"} onClick={run}>
      {label}
    </Button>
  );
}

/* ---------- the view ---------- */

export function ScriptView({
  lead,
  onChange,
  onOutcome,
}: {
  lead: LeadRow;
  onChange: (p: Partial<LeadRow>) => void;
  onOutcome: Api["outcome"];
}) {
  const { me } = useDesk();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latest = useRef(lead);
  latest.current = lead;

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  useEffect(() => {
    setDrafts({});
  }, [lead.id]);

  const merged = useMemo(() => {
    let l = lead;
    for (const [k, v] of Object.entries(drafts)) l = { ...l, ...fieldPatch(l, k, v) };
    return l;
  }, [lead, drafts]);

  const set = useCallback(
    (key: string, value: string) => {
      setDrafts((d) => ({ ...d, [key]: value }));
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => {
        onChange(fieldPatch(latest.current, key, value));
        setDrafts((d) => {
          const n = { ...d };
          if (n[key] === value) delete n[key];
          return n;
        });
      }, 600);
    },
    [onChange],
  );

  const now = new Date();
  const api: Api = { ctx: { lead: merged, me, now }, set, patch: onChange, outcome: onOutcome };
  const script = scriptFor(merged);
  const sections = script.sections.filter((s) => show(s.showWhen, api.ctx));

  return (
    <div className="space-y-4">
      <datalist id="carrier-list">
        {carrierSuggestions(readProfile(me.profile)).map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <nav className="sticky top-14 z-20 -mx-1 flex gap-1 overflow-x-auto bg-background/95 px-1 py-2 backdrop-blur">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#sec-${s.id}`}
            className="flex shrink-0 items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-semibold hover:border-sky"
          >
            <span className="text-primary">{s.letter}</span>
            <span className="text-muted-foreground">{s.title}</span>
          </a>
        ))}
      </nav>
      {sections.map((s) => (
        <SectionView key={s.id} s={s} api={api} />
      ))}
    </div>
  );
}

function SectionView({ s, api }: { s: Section; api: Api }) {
  return (
    <section
      id={`sec-${s.id}`}
      className="scroll-mt-28 space-y-4 rounded-xl border bg-card p-5 shadow-card md:p-6"
    >
      <h2 className="flex items-center gap-3 text-xl font-bold">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary font-display text-primary-foreground">
          {s.letter}
        </span>
        <span className="text-primary">{s.title}</span>
      </h2>
      {s.blocks.map((b, i) => (
        <BlockView key={i} b={b} api={api} sectionId={s.id} />
      ))}
    </section>
  );
}
