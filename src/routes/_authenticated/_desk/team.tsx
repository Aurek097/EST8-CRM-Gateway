import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDesk } from "@/lib/desk";
import { PageHeader, Panel, Empty } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { A2pCompliance } from "@/components/a2p-registration";

export const Route = createFileRoute("/_authenticated/_desk/team")({
  head: () => ({
    meta: [
      { title: "Team & Downlines · EST8 CallDesk" },
      { name: "description", content: "Team totals, agent roster and downline pre-registration." },
      { property: "og:title", content: "Team & Downlines · EST8 CallDesk" },
      {
        property: "og:description",
        content: "Team totals, agent roster and downline pre-registration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Team,
});

type Row = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  npn: string | null;
  is_active: boolean;
  role: "admin" | "agent" | null;
  leads: number;
  appts: number;
  dials: number;
};

function Team() {
  const { isAdmin, me, openBook } = useDesk();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "agent">("all");

  const { data } = useQuery({
    queryKey: ["team"],
    enabled: isAdmin,
    queryFn: async () => {
      const [
        { data: profiles },
        { data: roles },
        { data: leads },
        { data: calls },
        { data: invites },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,full_name,phone,npn,is_active")
          .order("full_name"),
        supabase.from("user_roles").select("user_id,role"),
        supabase.from("leads").select("user_id,status"),
        supabase.from("call_logs").select("user_id"),
        supabase
          .from("invites")
          .select("*")
          .is("claimed_at", null)
          .order("created_at", { ascending: false }),
      ]);
      const rows: Row[] = (profiles ?? []).map((p) => {
        const r = (roles ?? []).filter((x) => x.user_id === p.id).map((x) => x.role);
        const myLeads = (leads ?? []).filter((l) => l.user_id === p.id);
        return {
          ...p,
          role: r.includes("admin") ? "admin" : r.includes("agent") ? "agent" : null,
          leads: myLeads.length,
          appts: myLeads.filter((l) => l.status === "appointment").length,
          dials: (calls ?? []).filter((c) => c.user_id === p.id).length,
        };
      });
      return { rows, invites: invites ?? [] };
    },
  });

  if (!isAdmin)
    return (
      <div className="p-6">
        <Empty title="Admins only" body="Team & Downlines is for admins." />
      </div>
    );

  const rows = (data?.rows ?? []).filter((r) => {
    const s = `${r.full_name ?? ""} ${r.email} ${r.npn ?? ""}`.toLowerCase();
    return s.includes(q.toLowerCase()) && (roleFilter === "all" || r.role === roleFilter);
  });
  const all = data?.rows ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["team"] });

  const setRole = async (r: Row, role: "admin" | "agent") => {
    await supabase.from("user_roles").delete().eq("user_id", r.id);
    const { error } = await supabase.from("user_roles").insert({ user_id: r.id, role });
    if (error) toast.error("Couldn't change role");
    else toast.success("Role updated");
    refresh();
  };
  const setActive = async (r: Row, active: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", r.id);
    if (error) toast.error("Couldn't update");
    refresh();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader eyebrow="Admin" title="Team & Downlines" />
      <A2pCompliance />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="Downline agents" value={all.filter((r) => r.role === "agent").length} />
        <Tile label="Super admins" value={all.filter((r) => r.role === "admin").length} />
        <Tile label="Team dials" value={all.reduce((a, r) => a + r.dials, 0)} />
        <Tile label="Appointments" value={all.reduce((a, r) => a + r.appts, 0)} />
        <Tile label="Leads" value={all.reduce((a, r) => a + r.leads, 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel title="Roster">
          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              placeholder="Search name, email or NPN"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-xs"
            />
            {(["all", "admin", "agent"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={roleFilter === f ? "default" : "outline"}
                onClick={() => setRoleFilter(f)}
              >
                {f === "all" ? "All" : f === "admin" ? "Super Admins" : "Downline Agents"}
              </Button>
            ))}
          </div>
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-48 flex-1">
                  <div className="font-semibold">{r.full_name || r.email}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {r.email} · NPN {r.npn || "—"} · {r.phone || "—"}
                  </div>
                </div>
                <Badge variant="secondary">
                  {r.role === "admin"
                    ? "Super Admin"
                    : r.role === "agent"
                      ? "Downline Agent"
                      : "No role"}
                </Badge>
                <span className={r.is_active ? "text-xs text-success" : "text-xs text-danger"}>
                  {r.is_active ? "Active" : "Inactive"}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {r.dials}d · {r.appts}a · {r.leads}L
                </span>
                <div className="flex gap-1">
                  {r.id !== me.id && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          openBook(r.id, r.full_name || r.email);
                          navigate({ to: "/dialer" });
                        }}
                      >
                        Open book
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRole(r, r.role === "admin" ? "agent" : "admin")}
                      >
                        Make {r.role === "admin" ? "agent" : "admin"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setActive(r, !r.is_active)}>
                        {r.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {data?.invites.length ? (
            <div className="mt-6">
              <h3 className="eyebrow mb-2">Waiting for first sign-in</h3>
              {data.invites.map((i) => (
                <div key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {i.full_name || "—"}{" "}
                    <span className="font-mono text-muted-foreground">{i.email}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await supabase.from("invites").delete().eq("id", i.id);
                      refresh();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
        <InviteForm onDone={refresh} />
      </div>
    </div>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const { me } = useDesk();
  const empty = {
    full_name: "",
    email: "",
    phone: "",
    npn: "",
    states: "",
    role: "agent" as "agent" | "admin",
  };
  const [f, setF] = useState(empty);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(f.email)) {
      toast.error("Enter a valid Google email");
      return;
    }
    const { error } = await supabase.from("invites").insert({
      email: f.email.trim().toLowerCase(),
      full_name: f.full_name || null,
      phone: f.phone || null,
      npn: f.npn || null,
      licensed_states: f.states
        .split(/[\s,]+/)
        .map((s) => s.toUpperCase())
        .filter((s) => /^[A-Z]{2}$/.test(s)),
      role: f.role,
      invited_by: me.id,
    });
    if (error) {
      toast.error(
        error.code === "23505" ? "That email is already registered" : "Couldn't register",
      );
      return;
    }
    toast.success("Agent registered. They can sign in with Google now.");
    setF(empty);
    onDone();
  };
  return (
    <Panel title="Pre-register a downline agent">
      <form onSubmit={submit} className="space-y-3">
        {(
          [
            ["full_name", "Full name"],
            ["email", "Google email"],
            ["phone", "Phone"],
            ["npn", "NPN"],
            ["states", "Licensed states"],
          ] as const
        ).map(([k, l]) => (
          <div key={k} className="space-y-1.5">
            <Label>{l}</Label>
            <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </div>
        ))}
        <div className="flex gap-2">
          {(["agent", "admin"] as const).map((r) => (
            <Button
              type="button"
              key={r}
              size="sm"
              variant={f.role === r ? "default" : "outline"}
              onClick={() => setF({ ...f, role: r })}
            >
              {r === "agent" ? "Downline Agent" : "Super Admin"}
            </Button>
          ))}
        </div>
        <Button type="submit" variant="ember" className="w-full">
          Register agent
        </Button>
      </form>
    </Panel>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-primary">{value}</p>
    </div>
  );
}
