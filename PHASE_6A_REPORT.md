# Phase 6A implementation and verification report

## Implemented
- Settings → Phone System → A2P Registration, linked from desktop/mobile navigation and Numbers.
- Five-step business/campaign wizard, progress, encrypted manual draft saving, conditional incorporated/public/sole-proprietor fields, validation and fee/authorization review.
- US legal-business registration, independent versus actual EST8 legal entity authority; no automatic downline EIN sharing, no SSNs, no invented opt-in evidence.
- AES-GCM encrypted private business/campaign drafts and provider rejection feedback; stored tax identifiers are never returned to the browser. Status data has read-only owner/admin RLS; private drafts have no browser grants.
- Authenticated active-member server actions, server-side admin checks, persistent rate limits, audit records and unique permanent paid-operation locks. Uncertain failures require reconciliation rather than blind retries.
- Brand lookup before creation; campaign referenceId; separate fee review and explicit submission authorization. Successful API creation is never labeled carrier approval.
- Sole-proprietor SMS OTP request/verification/status. Verified brand required before campaign submission.
- Authoritative provider status polling while the page is open, manual refresh, signed webhook receiver. Webhook deliveries re-read authoritative state and are idempotent.
- Campaign sample corrections and explicitly authorized manual appeals for TELNYX_FAILED/MNO_REJECTED. No automatic rejection resubmission.
- Number ownership checks, association creation and read-back, incompatible campaign blocking, one-number sole-proprietor limit.
- Business SMS fail-closed checks on actual brand/campaign/number status before sending. Voice calling rules are unchanged.
- Admin registration dashboard, fee/charge snapshots, approved/pending numbers, failed operations and messaging suspension.

## Telnyx endpoints integrated
All under `https://api.telnyx.com/v2`:
- GET `/10dlc/enum/{entityType,vertical,usecase,stockExchange}`
- GET/POST `/10dlc/brand`; GET `/10dlc/brand/{brandId}`
- GET/POST/PUT `/10dlc/brand/{brandId}/smsOtp`
- GET `/10dlc/campaignBuilder/brand/{brandId}/usecase/{usecase}`
- GET `/10dlc/campaign/usecase/cost?usecase=...`
- POST `/10dlc/campaignBuilder`
- GET/PUT `/10dlc/campaign/{campaignId}` (PUT limited to sample corrections)
- POST `/10dlc/campaign/{campaignId}/appeal`
- GET `/10dlc/phone_number_campaigns/{phoneNumber}`; POST `/10dlc/phone_number_campaigns`
- Signed callback: `/api/public/telephony/a2p-events` on the published EST8 domain.

Sources: [Telnyx OpenAPI](https://developers.telnyx.com/openapi/source/external/messaging/10dlc.json), [sole-proprietor guide](https://developers.telnyx.com/docs/messaging/10dlc/sole-proprietor), [campaign guide](https://developers.telnyx.com/docs/messaging/10dlc/campaign-registration).

## Actually tested
- 37 tests passed: 20 A2P rule/mock-operation tests plus 16 calling/texting regression tests and 1 routing test.
- A2P tests cover conditional EIN/mobile requirements, legal authority, provider enum validation, no assumed purchased-lead consent, carrier provisioning, association/pending states, suspension/stale status blocking, simulated success, duplicate locks and rejected-operation retry prevention.
- Authenticated browser: opened wizard, displayed real Telnyx permission blocker, saved a harmless draft, reloaded and read it back, triggered missing-field validation, switched to sole proprietor and verified mobile replaces EIN, opened admin compliance section.
- Desktop and 390px mobile screenshots inspected; no mobile horizontal overflow.
- Schema changes verified present in the database; owner/admin SELECT policies and absence of browser private-data grants inspected.
- Unsigned webhook rejected with HTTP 401.
- No live brands/campaigns registered, OTP sent, appeals filed or numbers associated. No calls/texts sent. Provider mutations remain unverified end-to-end until explicitly authorized after account access is enabled.
- Cross-agent policies were inspected; a second signed-in agent end-to-end isolation test has not been performed. Full mocked server/database/provider integration tests remain to be added; existing mock tests exercise the paid-operation guard and pure rules, not every server action.

## Account requirements and production blockers
1. Current account returns HTTP 403, code 10038 for 10DLC access. Registration permission/account upgrade must be granted by Telnyx; drafts remain available.
2. Official brand/review fee documentation conflicts. An administrator must enter fees confirmed for this actual account and their source. Campaign use-case costs are retrieved live. Paid submission is blocked without a current complete review; no guessed charge was used.
3. Publish this update before expecting the new status webhook on the public domain to work.
4. Real legal-business data, valid public opt-in evidence/privacy/terms pages, explicit paid-submission authorization and carrier approval are still required.
5. Non-US identifiers and mixed/sub-usecase campaigns deliberately block instead of guessing unsupported payloads. The sole-proprietor guide mentions DOB, but the current Brand API schema has no DOB field; no invented DOB/SSN payload was added.
6. Existing shared-brand linking and brand legal-data correction require verified ownership/provider-approved support. The app detects existing businesses and avoids creating duplicates but does not attach them automatically. Rejected campaign sample correction/manual appeal is implemented.
7. Permanent locks prioritize preventing duplicate paid submissions. Ambiguous operations cannot self-retry; manual provider reconciliation is required. Background scheduled polling is not configured; signed callbacks plus page-open polling provide synchronization.
8. No new AI assistant was added or changed in this phase; existing app functionality was preserved.