import { profileAlerts, readProfile } from "@/lib/profile";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, Settings, Hash, MessageSquareText, Menu, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { accessQuery, DeskProvider, initials, useDesk } from "@/lib/desk";
import { useWeekStats } from "@/lib/week-stats";
import { PhoneProvider } from "@/lib/phone";
import { FreshLeadAlert } from "@/components/fresh-lead-alert";
import { Est8Mark, PartnerLine } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_desk")({
  component: DeskLayout,
});

function DeskLayout() {
  const { data, isLoading, refetch } = useQuery(accessQuery);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Opening your desk…
      </div>
    );
  }
  if (!data || !data.profile || !data.hasAccess) {
    return <Blocked email={data?.user.email ?? ""} onRetry={refetch} />;
  }
  return (
    <DeskProvider me={data.profile} isAdmin={data.isAdmin}>
      <PhoneProvider>
        <FreshLeadAlert />
        <div className="flex min-h-screen flex-col">
          <TopBar />
          <BookBanner />
          <main className="flex-1">
            <Outlet />
          </main>
          <footer className="border-t px-6 py-4">
            <PartnerLine />
          </footer>
        </div>
      </PhoneProvider>
    </DeskProvider>
  );
}

function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    sessionStorage.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };
}

function Blocked({ email, onRetry }: { email: string; onRetry: () => unknown }) {
  const signOut = useSignOut();
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    const { data } = await supabase.rpc("claim_access");
    await onRetry();
    setBusy(false);
    if (!data) toast("Still not registered. Ask your admin to add this email.");
  };
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-card">
        <Est8Mark />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-primary">You're not on the team yet</h1>
          <p className="text-muted-foreground">
            <span className="font-mono text-foreground">{email}</span> hasn't been registered. Ask
            your EST8 admin to pre-register this Google email, then tap Retry.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={retry} disabled={busy}>
            {busy ? "Checking…" : "Retry"}
          </Button>
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { to: "/dialer", label: "Dialer" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/profile", label: "Profile" },
] as const;

function TopBar() {
  const { me, isAdmin, bookUserId } = useDesk();
  const { data: stats } = useWeekStats(bookUserId);
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);

  const alerts = profileAlerts(readProfile(me.profile));
  const pos = readProfile(me.profile);
  const navItems = [
    ...NAV,
    ...(isAdmin ? [{ to: "/team", label: "Team & Downlines" } as const] : []),
  ];

  return (
    <header className="sticky top-0 z-40 bg-topbar text-topbar-foreground">
      <div className="flex h-14 items-center gap-3 px-4">
        <Link to="/dialer" className="flex items-center gap-2.5">
          <Est8Mark />
          <span className="hidden font-display text-base font-semibold sm:inline">CallDesk</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {navItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-topbar-foreground/75 transition hover:bg-topbar-foreground/10 hover:text-topbar-foreground"
              activeProps={{ className: "bg-topbar-foreground/15 text-topbar-foreground" }}
            >
              {n.label}
              {n.to === "/profile" && alerts.length > 0 && (
                <span
                  className={cn(
                    "ml-1.5 inline-block size-2 rounded-full",
                    alerts.some((a) => a.tone === "bad") ? "bg-danger" : "bg-warning",
                  )}
                  aria-label="Profile alerts"
                />
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-4 font-mono text-xs lg:flex">
          <Stat label="Dials" value={`${stats?.dials ?? 0}/500`} />
          <Stat label="Appts" value={`${stats?.appts ?? 0}/20`} />
          <Stat label="Apps" value={`${stats?.apps ?? 0}`} />
        </div>

        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          <Link to="/numbers" className="hidden sm:block">
            <Button variant="topbar" size="sm">
              <Hash /> Numbers
              <span className="rounded bg-topbar-foreground/15 px-1.5 font-mono">
                {stats?.numbers ?? 0}
              </span>
            </Button>
          </Link>
          <Link to="/a2p" className="hidden sm:block">
            <Button variant="topbar" size="sm" title="A2P registration">
              <MessageSquareText /> A2P
            </Button>
          </Link>
          <Link to="/settings" className="hidden sm:block">
            <Button variant="topbar" size="icon" aria-label="Settings">
              <Settings />
            </Button>
          </Link>

          {isAdmin && <DeskMenu />}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 flex size-9 items-center justify-center overflow-hidden rounded-full bg-sky font-display text-sm font-bold text-primary-foreground ring-2 ring-topbar-foreground/20">
                {me.avatar_url ? (
                  <img
                    src={me.avatar_url}
                    alt=""
                    className="size-full object-cover"
                    style={{ objectPosition: `${pos.photoX ?? 50}% ${pos.photoY ?? 50}%` }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  initials(me.full_name, me.email)
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="font-semibold">{me.full_name || "Agent"}</div>
                <div className="truncate text-xs font-normal text-muted-foreground">{me.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="topbar"
            size="icon"
            className="md:hidden"
            aria-label="Menu"
            onClick={() => setOpen((o) => !o)}
          >
            <Menu />
          </Button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-topbar-foreground/10 px-4 py-3 md:hidden">
          {[
            ...navItems,
            { to: "/numbers", label: "Numbers" } as const,
            { to: "/a2p", label: "A2P Registration" } as const,
            { to: "/settings", label: "Settings" } as const,
          ].map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-topbar-foreground/80"
              activeProps={{ className: "bg-topbar-foreground/15 text-topbar-foreground" }}
            >
              {n.label}
              {n.to === "/profile" && alerts.length > 0 && (
                <span
                  className={cn(
                    "ml-1.5 inline-block size-2 rounded-full",
                    alerts.some((a) => a.tone === "bad") ? "bg-danger" : "bg-warning",
                  )}
                  aria-label="Profile alerts"
                />
              )}
            </Link>
          ))}
          <div className="mt-2 flex gap-4 px-3 font-mono text-xs">
            <Stat label="Dials" value={`${stats?.dials ?? 0}/500`} />
            <Stat label="Appts" value={`${stats?.appts ?? 0}/20`} />
            <Stat label="Apps" value={`${stats?.apps ?? 0}`} />
          </div>
        </nav>
      )}
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-topbar-foreground/60">
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function DeskMenu() {
  const { me, bookUserId, openBook } = useDesk();
  const { data: agents } = useQuery({
    queryKey: ["agentsList"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      return data ?? [];
    },
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="topbar" size="sm" className={cn(bookUserId !== me.id && "bg-ember/30")}>
          <Eye /> <span className="hidden sm:inline">Desk</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Whose book</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openBook(me.id, null)}>My Desk</DropdownMenuItem>
        {(agents ?? [])
          .filter((a) => a.id !== me.id)
          .map((a) => (
            <DropdownMenuItem key={a.id} onClick={() => openBook(a.id, a.full_name || a.email)}>
              {a.full_name || a.email}
              {a.id === bookUserId && (
                <span className="ml-auto text-xs text-muted-foreground">open</span>
              )}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BookBanner() {
  const { me, bookUserId, bookName, openBook } = useDesk();
  if (bookUserId === me.id) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-ember px-4 py-2 text-sm font-medium text-ember-foreground">
      <span>You're viewing {bookName}'s desk. Changes save to their book.</span>
      <button className="underline" onClick={() => openBook(me.id, null)}>
        Back to My Desk
      </button>
    </div>
  );
}
