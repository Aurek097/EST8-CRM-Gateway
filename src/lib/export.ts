import Papa from "papaparse";
import { fullName, stateCode, type LeadRow } from "./leads";
import { stageLabel } from "./stages";

/** Leads in states the agent isn't licensed in are left out. Never includes bank details. */
export function leadsToCsv(leads: LeadRow[], licensed: string[]) {
  const BLOCKED = new Set([
    "bankName",
    "routing",
    "routingNumber",
    "account",
    "accountNumber",
    "bank",
  ]);
  const rows = leads
    .filter((l) => !licensed.length || licensed.includes(stateCode(l.state) ?? ""))
    .map((l) => {
      const d = Object.fromEntries(
        Object.entries((l.data ?? {}) as Record<string, unknown>).filter(
          ([k]) => !BLOCKED.has(k) && k !== "extra",
        ),
      );
      return {
        name: fullName(l),
        type: l.lead_type === "fe" ? "Final expense" : "Mortgage protection",
        stage: stageLabel(l.status),
        first_name: l.first_name,
        last_name: l.last_name,
        phone: l.phone,
        email: l.email,
        address: l.address,
        city: l.city,
        state: l.state,
        zip: l.zip,
        dials: l.dials,
        last_dial: l.last_dial,
        follow_at: l.follow_at,
        follow_what: l.follow_what,
        lead_source: l.lead_source,
        lead_date: l.lead_date,
        ...d,
      };
    });
  return { csv: Papa.unparse(rows), count: rows.length, skipped: leads.length - rows.length };
}
