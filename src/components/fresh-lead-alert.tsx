import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useLeads } from "@/lib/use-leads";
import { fullName } from "@/lib/leads";

/** Opener A says call within 5 minutes: alert once for any lead that arrives under 5 minutes old. */
export function FreshLeadAlert() {
  const { data: leads = [], refetch } = useLeads();
  const seen = useRef<Set<string> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => refetch(), 30000);
    return () => clearInterval(t);
  }, [refetch]);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(leads.map((l) => l.id));
      return;
    }
    for (const l of leads) {
      if (seen.current.has(l.id)) continue;
      seen.current.add(l.id);
      const age = Date.now() - new Date(l.lead_date ?? l.created_at).getTime();
      if (age < 5 * 60_000 && l.status === "new") {
        toast(`Fresh lead: ${fullName(l)}`, {
          description: "Call within 5 minutes (Opener A).",
          duration: 60_000,
          action: {
            label: "Open",
            onClick: () => navigate({ to: "/dialer", search: { lead: l.id } }),
          },
        });
      }
    }
  }, [leads, navigate]);
  return null;
}
