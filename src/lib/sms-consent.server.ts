import { admin } from "./telnyx.server";
import { keywordAction, consentAllows, DISCLOSURE_VERSION } from "./agency-a2p-rules";
import { agency, member } from "./agency-a2p.server";
import { api, verifySmsCompliance } from "./a2p.server";
async function scope(userId: string) {
  const a = await agency();
  return a.profile.verified && (await member(userId)) && a.profile.registrationOwner
    ? a.profile.registrationOwner
    : userId;
}
export async function consentFailure(userId: string, phone: string, promotional: boolean) {
  const db = await admin(),
    owner = await scope(userId);
  const { data: s, error: se } = await db
    .from("sms_suppressions")
    .select("suppressed")
    .eq("user_id", owner)
    .eq("phone_number", phone)
    .maybeSingle();
  const { data: events, error } = await db
    .from("sms_consent_events")
    .select("transactional,marketing")
    .eq("user_id", owner)
    .eq("phone_number", phone)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || se) return "Consent evidence could not be verified.";
  const e = events?.[0];
  return consentAllows(
    e?.transactional ?? false,
    e?.marketing ?? false,
    promotional,
    s?.suppressed ?? false,
  )
    ? null
    : "Verified consent for this sender and message category is required; opted-out contacts remain blocked.";
}
export async function handleKeyword(
  userId: string,
  from: string,
  to: string,
  text: string,
  providerAutoResponse: boolean,
  eventId: string,
) {
  const action = keywordAction(text);
  if (!action) return;
  const db = await admin(),
    owner = await scope(userId),
    a = await agency();
  if (action === "stop" || action === "start") {
    const { error } = await db.from("sms_suppressions").upsert({
      user_id: owner,
      phone_number: from,
      suppressed: action === "stop",
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Suppression could not be recorded.");
    // START removes suppression only; it never creates marketing consent.
    await db
      .from("leads")
      .update({ sms_opt_out: action === "stop" })
      .eq("user_id", userId)
      .eq("phone_digits", from.slice(-10));
  }
  if (providerAutoResponse || !eventId) return;
  if (!a.profile.verified || !(await verifySmsCompliance(userId, to))) return;
  const message =
    action === "stop"
      ? a.profile.campaign.optoutMessage
      : action === "start"
        ? a.profile.campaign.optinMessage
        : [a.profile.supportEmail, a.profile.supportPhone].some(Boolean)
          ? `EST8 Financial Group: For assistance, contact ${[a.profile.supportEmail, a.profile.supportPhone].filter(Boolean).join(" or ")}. Reply STOP to unsubscribe.`
          : "";
  if (message) {
    const { error } = await db.from("sms_keyword_responses").insert({ event_id: eventId });
    if (error?.code === "23505") return;
    if (error) throw new Error("Keyword response could not be recorded.");
    await api("/messages", "POST", { from: to, to: from, text: message });
    await db.from("sms_keyword_responses").update({ state: "sent" }).eq("event_id", eventId);
  }
}
