<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

# Project rules

- Built in the spec's five phases; roadmap.md tracks progress. Why: spec is designed for one phase per prompt.
- Access is invite-only: the `invites` table + `grant_access_for` DB function assign roles on first sign-in; the first user ever becomes admin. Why: replaces an ADMIN_EMAILS secret with no setup.
- Roles live only in `user_roles`, checked via `has_role`. Why: avoids privilege escalation.
- Admin "open book" is client state (DeskProvider.bookUserId); RLS lets admins read/write any agent's rows. Why: matches spec's supervise flow.
- Lead vendor columns beyond the core contact fields live in `leads.data` (jsonb, camelCase keys from the spec); CRM rules are pure functions in src/lib (leads.ts, lead-mutations.ts, import.ts, export.ts) covered by src/test/crm-rules.test.ts. Why: keeps rules testable and schema stable as scripts add fields.
- Scripts are JSON-serializable data in src/scripts (types.ts, mp-step1/2, fe); show-when rules, tokens and calculations are referenced by id and resolved in src/scripts/engine.ts (tested in src/test/script-engine.test.ts). Why: spec wants scripts editable as data; moving them into a DB table later needs no engine change.
- Agent profile cards live in profiles.profile (jsonb, shape in src/lib/profile.ts with pure rules for licenses, carrier aliases, alerts and the Quoteplicity URL, tested in src/test/profile-rules.test.ts); licensed_states is re-derived from license rows on save. Agent DOB/driver's license live in agent_private (owner-only RLS, no admin read). Photos are stored as resized data URLs because the workspace blocks public storage buckets.
- Telephony: Telnyx REST via src/lib/telnyx.server.ts (dynamically imported in handlers); call/text rules are pure in src/lib/call-rules.ts (tested). Webhooks live at /api/public/telephony/{voice,sms}-events with Ed25519 checks; call-leg context travels in Telnyx client_state (stateless workers). Lead intake auth is a per-agent profiles.intake_key, not a shared secret.
- Call logs, texts and webhook events are server-written only (no authenticated insert grants). Why: spec data rule.
- A2P runs through authenticated a2p.functions.ts and server-only a2p.server.ts; private drafts use AES-GCM, public status tables have read-only owner/admin policies, paid operations use permanent unique locks, and SMS checks live provider status. Why: tenant isolation, no duplicate charges and fail-closed messaging.
- Agency A2P profiles are encrypted server-only records; explicit admin sender-membership grants govern inheritance and shared-registration pointers, public consent events are immutable server writes, and permission failures are cached until admin recheck. Why: no downline impersonation, invented consent or repeated restricted submissions.
