import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDesk } from "@/lib/desk";
import { useLeads } from "@/lib/use-leads";
import { leadsToCsv } from "@/lib/export";
import { PageHeader, Panel } from "@/components/shell";
import {
  A2PPanel,
  CallingSettings,
  DiagnosticsPanel,
  IntakePanel,
} from "@/components/phone-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/_desk/settings")({
  head: () => ({
    meta: [
      { title: "Settings · EST8 CallDesk" },
      {
        name: "description",
        content: "Appointment offer times, lead export and phone integration status.",
      },
      { property: "og:title", content: "Settings · EST8 CallDesk" },
      {
        property: "og:description",
        content: "Appointment offer times, lead export and phone integration status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { me, isAdmin } = useDesk();
  const qc = useQueryClient();
  const s = (me.settings ?? {}) as { offerTimeA?: string; offerTimeB?: string };
  const [a, setA] = useState(s.offerTimeA ?? "5:15 pm");
  const [b, setB] = useState(s.offerTimeB ?? "6:45 pm");

  const { data: leads = [] } = useLeads();
  const exportCsv = () => {
    const { csv, count, skipped } = leadsToCsv(leads, me.licensed_states ?? []);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `calldesk-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      `Exported ${count} leads${skipped ? ` · ${skipped} left out (not licensed)` : ""}`,
    );
  };

  const save = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({ settings: { ...s, offerTimeA: a, offerTimeB: b } })
      .eq("id", me.id);
    if (error) {
      toast.error("Couldn't save");
      return;
    }
    toast.success("Offer times saved");
    qc.invalidateQueries({ queryKey: ["access"] });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader eyebrow="Desk" title="Settings & Integrations" />
      {isAdmin && (
        <Panel title="Agency Administration">
          <Button asChild variant="outline">
            <Link to="/agency-a2p">A2P Business Profile</Link>
          </Button>
        </Panel>
      )}
      <Panel title="Appointment offer times">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Offer A</Label>
            <Input value={a} onChange={(e) => setA(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Offer B</Label>
            <Input value={b} onChange={(e) => setB(e.target.value)} />
          </div>
        </div>
        <Button className="mt-4" onClick={save}>
          Save times
        </Button>
      </Panel>
      <Panel title="Export leads as CSV">
        <p className="mb-3 text-sm text-muted-foreground">
          Leads in states you aren't licensed in are left out.
        </p>
        <Button variant="outline" onClick={exportCsv}>
          Download CSV
        </Button>
      </Panel>
      <CallingSettings />
      <div id="a2p">
        <A2PPanel />
      </div>
      <IntakePanel />
      {isAdmin && <DiagnosticsPanel />}
    </div>
  );
}
