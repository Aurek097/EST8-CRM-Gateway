import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDesk } from "@/lib/desk";
import { formatPhone, US_STATES } from "@/lib/leads";
import { buyNumber, releaseNumber, searchNumbers } from "@/lib/telephony.functions";
import { PageHeader, Panel, Empty } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/_desk/numbers")({
  head: () => ({
    meta: [
      { title: "Numbers · EST8 CallDesk" },
      { name: "description", content: "Your calling and texting phone numbers." },
      { property: "og:title", content: "Numbers · EST8 CallDesk" },
      { property: "og:description", content: "Your calling and texting phone numbers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Numbers,
});

type Found = { phone: string; city: string | null; state: string | null; monthly: string | null };

function Numbers() {
  const { bookUserId, isAdmin } = useDesk();
  const qc = useQueryClient();
  const search = useServerFn(searchNumbers);
  const buy = useServerFn(buyNumber);
  const release = useServerFn(releaseNumber);
  const key = ["numbers", bookUserId];
  const { data: mine = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await supabase
          .from("phone_numbers")
          .select("*")
          .eq("user_id", bookUserId)
          .order("created_at")
      ).data ?? [],
  });
  const { data: associations = [] } = useQuery({
    queryKey: ["number-a2p", bookUserId],
    queryFn: async () =>
      (
        await supabase
          .from("a2p_number_links")
          .select("phone_number,campaign_id,status,registration_id")
          .eq("user_id", bookUserId)
      ).data ?? [],
  });
  const [area, setArea] = useState("");
  const [state, setState] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["weekStats"] });
  };

  const doSearch = async () => {
    setBusy("search");
    const r = await search({
      data: { areaCode: /^\d{3}$/.test(area) ? area : undefined, state: state || undefined },
    });
    setBusy(null);
    if (r.error) toast.error(r.error);
    setFound(r.numbers);
    if (!r.error && !r.numbers.length) toast("No numbers found. Try another area code.");
  };
  const doBuy = async (n: Found) => {
    setBusy(n.phone);
    const r = await buy({
      data: { phone: n.phone, state: n.state ?? (state || null), forUserId: bookUserId },
    });
    setBusy(null);
    if ("error" in r && r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(`${formatPhone(n.phone)} is yours`);
    setFound((f) => f.filter((x) => x.phone !== n.phone));
    refresh();
  };
  const makePrimary = async (id: string) => {
    await supabase.from("phone_numbers").update({ is_primary: false }).eq("user_id", bookUserId);
    await supabase.from("phone_numbers").update({ is_primary: true }).eq("id", id);
    refresh();
  };
  const doRelease = async (id: string) => {
    const r = await release({ data: { id } });
    if ("error" in r && r.error) {
      toast.error(r.error);
      return;
    }
    toast.success("Number released");
    setArmed(null);
    refresh();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader eyebrow="Phone" title="Numbers" />
      <Button asChild variant="outline">
        <Link to="/a2p">A2P Registration & number association</Link>
      </Button>
      <Panel title="Your numbers">
        {mine.length === 0 ? (
          <Empty
            title="No numbers yet"
            body={
              isAdmin
                ? "Search below and buy a local number for each state you call."
                : "Ask your admin to buy you a local number."
            }
          />
        ) : (
          <ul className="divide-y">
            {mine.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0">
                  <span className="font-mono text-base">{formatPhone(n.phone_number)}</span>
                  {associations
                    .filter((a) => a.phone_number === n.phone_number)
                    .map((a) => (
                      <p key={a.phone_number} className="break-all text-xs text-muted-foreground">
                        {a.status} · Campaign {a.campaign_id}
                      </p>
                    ))}
                </div>
                <span className="text-xs text-muted-foreground">{n.region ?? ""}</span>
                {n.is_primary ? (
                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                    Primary
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => makePrimary(n.id)}>
                    <Star /> Make primary
                  </Button>
                )}
                {isAdmin &&
                  (armed === n.id ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="ml-auto"
                      onClick={() => doRelease(n.id)}
                    >
                      Release?
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="ml-auto"
                      aria-label="Release number"
                      onClick={() => setArmed(n.id)}
                    >
                      <Trash2 />
                    </Button>
                  ))}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Calls show your number in the lead's state when you have one, otherwise your primary
          number.
        </p>
      </Panel>
      {isAdmin && (
        <Panel title="Buy a number">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="n-area">Area code</Label>
              <Input
                id="n-area"
                className="w-28 font-mono"
                maxLength={3}
                value={area}
                onChange={(e) => setArea(e.target.value.replace(/\D/g, ""))}
                placeholder="281"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-state">or state</Label>
              <select
                id="n-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 font-mono text-sm"
              >
                <option value="">—</option>
                {Object.keys(US_STATES).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <Button onClick={doSearch} disabled={busy === "search" || (!area && !state)}>
              {busy === "search" ? "Searching…" : "Search"}
            </Button>
          </div>
          {found.length > 0 && (
            <ul className="mt-4 divide-y">
              {found.map((n) => (
                <li key={n.phone} className="flex items-center gap-3 py-2">
                  <span className="font-mono">{formatPhone(n.phone)}</span>
                  <span className="text-xs text-muted-foreground">
                    {[n.city, n.state].filter(Boolean).join(", ")}
                  </span>
                  {n.monthly && (
                    <span className="text-xs text-muted-foreground">${n.monthly}/mo</span>
                  )}
                  <Button size="sm" className="ml-auto" disabled={!!busy} onClick={() => doBuy(n)}>
                    {busy === n.phone ? "Buying…" : "Buy"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
