# Phase 6B status

## Added to the existing application
- Three-step onboarding: Confirm Details, Review Messaging, Review & Authorize. Existing five-step detailed controls, OTP, appeals and history remain available.
- Settings → Agency Administration → A2P Business Profile, with encrypted administrator-managed legal details, customer support, templates, privacy/terms/opt-in URLs, existing provider IDs and explicit individual legal-sender grants.
- Server-enforced agency inheritance; independent agents keep separate business details. New agency registrations are limited to the designated legal representative, preventing each agent creating a duplicate paid brand.
- Requested insurance description and sample templates; marketing sample omitted without verified marketing program/consent. START/STOP/HELP responses use verified support contacts. Legal/fee/consent attestations remain unchecked.
- Public `/sms-consent` inquiry form with optional unchecked service consent and separate optional marketing consent. Consent choices, exact disclosures/version, server timestamp, sender and source are stored. The form stays unavailable until genuine legal/support/terms configuration exists.
- Published-form verification checks the fixed public address, disclosure version, privacy link and a successful saved-form test. Opt-in description is generated only after verification, and editing the profile invalidates that verification.
- Authorized shared registration pointers reuse an existing CallDesk-owned agency brand/campaign after live provider checks of legal name, use case, verified identity and carrier provisioning. No new paid registration is created by reuse.
- Number association and SMS readiness continue through existing Telnyx APIs. Revoked sender grants and owner suspension block shared messaging.
- Suppression at the verified sender scope, consent checks by message category, keyword reply handling and permanent reply deduplication. STOP storage precedes webhook completion; START does not create marketing consent.
- Cached permission failure prevents repeated restricted checks; administrators control eligibility recheck. The actual observed restriction remains HTTP 403 code 10038; the brief mentions 10938, but the app displays the actual returned value rather than replacing it.
- Agent correction requests are visible in agency administration.

## Verified
- Signed-in browser: three-step navigation, unchecked personal/legal/billing attestations, blocked submission, draft saving, encrypted admin profile draft saved and read back after reload.
- Public form correctly displays awaiting verified details instead of pretending an opt-in process exists.
- Desktop/mobile screenshots inspected; 390px layout has no horizontal overflow.
- 62 tests: 21 agency rules, 4 mocked backend STOP/START/HELP/dedup tests, 20 prior A2P rules, 16 calling rules and 1 routing test.
- New tables verified in database and app compilation checked.
- No Telnyx registrations, OTPs, appeals, number associations or actual SMS submitted during testing; no real fees incurred.

## Still required / limitations
- Enter real agency legal/support details, privacy/terms URLs and designate the actual legal representative; verify per-agent authority separately from downline membership.
- Publish the form, submit a controlled inquiry, inspect recorded consent and confirm the published process. Fully configured public submission was not exercised because no genuine verified agency configuration was supplied.
- Telnyx must grant 10DLC access; confirm actual fees before paid authorization. Approved brand/campaign and number associations are not assumed.
- Existing reusable registrations must already be owned by the designated representative inside CallDesk. External portal-created registration adoption still requires a separately verified ownership workflow.
- Independent business draft onboarding is available, but external consent-form verification remains blocked rather than guessed.
- Full multi-agent RLS/approved shared-provider end-to-end checks remain unverified. Tests exercise inheritance/consent rules and mocked keyword transport, not real carrier behavior.
- Keyword response locks avoid duplicate replies, but an ambiguous provider send needs reconciliation; no blind retry. STOP is still persisted even if a reply cannot be sent.
- Marketing category is an explicit sender selection with stricter default; content classification is not automatically inferred.