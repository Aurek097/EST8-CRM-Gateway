import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone, ShieldCheck, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Est8Mark, PartnerLine } from "@/components/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in · EST8 CallDesk" },
      {
        name: "description",
        content:
          "EST8 CallDesk: live scripts, lead verification and CRM for life insurance phone sales.",
      },
      { property: "og:title", content: "EST8 CallDesk" },
      {
        property: "og:description",
        content:
          "Live scripts, lead verification and CRM for mortgage protection and final expense agents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignIn,
});

const GoogleG = () => (
  <svg
    aria-hidden="true"
    width="18"
    height="18"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

function SignIn() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dialer", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dialer", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in didn't finish. Try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dialer", replace: true });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between bg-brand p-12 text-topbar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <Est8Mark />
          <span className="font-display text-lg font-semibold">CallDesk</span>
        </div>
        <div className="max-w-md space-y-8">
          <h1 className="text-5xl font-bold leading-[1.05]">
            Click a lead. Read the script. Close the file.
          </h1>
          <ul className="space-y-4 text-topbar-foreground/85">
            <li className="flex gap-3">
              <Phone className="mt-0.5 size-5 text-ember" /> Live scripts with the lead's own
              details filled in.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 text-ember" /> Verify each detail as the client
              confirms it.
            </li>
            <li className="flex gap-3">
              <ListChecks className="mt-0.5 size-5 text-ember" /> New lead to policy in force, on
              one screen.
            </li>
          </ul>
        </div>
        <p className="text-xs text-topbar-foreground/60">Mortgage protection · Final expense</p>
      </section>

      <section className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Est8Mark />
            <span className="font-display text-lg font-semibold text-primary">CallDesk</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-primary">Sign in</h2>
            <p className="text-muted-foreground">
              CallDesk is invite-only. Use the Google account your admin registered.
            </p>
          </div>
          <button
            type="button"
            onClick={signIn}
            disabled={busy}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-input bg-card px-3 text-sm font-medium text-card-foreground shadow-card transition hover:bg-muted disabled:opacity-60"
          >
            <GoogleG />
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
          <PartnerLine />
        </div>
      </section>
    </div>
  );
}
