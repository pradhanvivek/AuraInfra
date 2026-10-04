# Security changes and store release runbook

Reviewed and implemented on 2026-10-03, with further release hardening on 2026-10-04, starting from `HOA-and-asset` at
`fce870105a2220b242a8e3083e56b53ec4ea129b`. These changes are not a production
deployment or a guarantee of store approval.

## Implemented behavior

- Community access comes from an active membership, the specific community's
  admin assignment, actual personal-property ownership, or a superadmin role.
  A resident's claimed owner role and another community's admin role do not grant
  administrative access. Pending and legacy auto-approved memberships grant no access.
- HOA endpoints check community scope; URL/body scope mismatches are rejected.
  Residents see their own visitor records and can cancel only their own bookings.
  Administrative payment aggregates are scoped to the community's charges.
- App JWTs expire after seven days and must match a live server session and user.
  Logout and deletion revoke sessions. Existing JWTs require a fresh sign-in.
- Google callbacks use the declared native scheme, local state and an expiring
  single-use provider exchange. The backend issues its own app JWT and refuses
  to link a password or Apple account merely by matching an email address.
- iOS includes Sign in with Apple. The backend verifies Apple's signature,
  issuer, audience, expiry and a single-use server nonce, exchanges the code,
  stores an encrypted refresh token, and revokes it during account deletion.
- Membership onboarding submits a pending request; an authorized community
  administrator reviews it. Proof documents are cleared after the decision.
  Conflicting approve/reject decisions cannot overwrite one another; interrupted
  membership application can retry the same decision.
- Password accounts confirm their password for deletion. Social accounts
  reauthenticate with the same provider and identity within five minutes.
  Persistent deletion jobs revoke access immediately and retry incomplete cleanup.
  Personal assets, memberships and authored content are deleted; shared accounting
  records are anonymized. Completed deletion records expire after 30 days.
- Posts and comments require acceptance of community standards and human review
  before publication. Editing returns content to review. Residents can report
  content, block authors and unblock them; scoped admins can review, remove content
  and suspend a community membership. Legacy unreviewed content is quarantined.
- A consent prompt identifies Google Gemini and OpenAI through Emergent before
  AI uploads. Server endpoints independently enforce consent; Profile can revoke it.
- Privacy, account-deletion and community-standards pages describe the implemented
  flows. Android production builds use AAB and target API 36; broad photo-library,
  microphone and overlay permissions are blocked. Production API configuration
  requires HTTPS. Native photo selection uses the system picker.

Additional release hardening:

- Password accounts can recover access from Login → Forgot password with an
  eight-digit email code. Codes expire after 10 minutes, allow at most five
  guesses, and are stored as keyed hashes. Resending invalidates the previous
  code. Three requests per account per hour and a per-IP limit reduce abuse.
  Responses do not disclose whether an email exists. Social accounts retain
  their original provider. Delivery uses TLS SMTP and must be configured/tested.
- Password reset atomically increments an account credential version. Old sessions
  and logins racing with a reset fail authentication, even if session cleanup fails.
  Reset records are removed on deletion and expired records have a TTL index.
- Serialized credential storage prevents a delayed sign-in from undoing logout.
  Late unauthorized responses from an old session cannot clear a new account.
  Account changes reset private screen state; property selection uses current
  server data and drops revoked communities. Detail screens ignore late fetches.
- Login, registration and AI consent scroll on small screens and with large text.
  Profile and Login expose support/privacy resources. The root error boundary
  offers recovery without displaying internal error details. Offline startup
  offers retry instead of incorrectly redirecting to terms acceptance.
- Native Google cold-start callbacks recover locally initiated sign-ins; a live
  browser authentication flow owns its callback to avoid a duplicate exchange.
  Real provider callbacks still require physical-device verification.
- Document viewing supports web download, Android viewer/share fallback and iOS
  sharing. Temporary native document files are removed after the viewer returns.
- Production Babel transformation removes console diagnostics; backend validation errors
  omit submitted values and production service failures use generic messages.
- Production builds validate an HTTPS API origin without URL credentials or paths;
  iOS App Transport Security disallows cleartext/local-network exceptions.
  Unused microphone, Face ID and photo-library-write descriptions are removed;
  the motion description explains the property-estimation orientation feature.

## Verification performed

| Check | Result |
| --- | --- |
| Backend isolated route/security suite | 130 passed; 1 remote integration module intentionally skipped |
| Frontend auth/consent/release regression tests | 22 passed |
| Frontend TypeScript | Passed |
| Frontend ESLint | No errors; 201 existing/performance/cleanup warnings remain |
| Android and iOS production JavaScript export | Passed |
| Expo native prebuild on Linux | Passed; Apple entitlement and native OAuth scheme generated; SDK 36 configured |
| Website TypeScript and Vite production build | Passed |

Tests use two separate communities, their admins/residents, security staff,
pending applicants and unrelated users. They exercise actual FastAPI routes with
an isolated mock Mongo database, local signing keys and mocked external providers.
They are not proof of behavior against a deployed Mongo server or real OAuth/payment
providers. Backend warnings include existing Pydantic and datetime deprecations.
CI repeats security tests, frontend checks, exports and the website build.

## Database rollout: required before deployment

1. Back up the intended database and rehearse this migration on a staging copy.
2. Run `python backend/migrate_security.py` with the intended `MONGO_URL` and
   `DB_NAME`. It audits without writes. Resolve reported duplicate usernames,
   normalized emails, memberships, approval requests and admin assignments by
   reviewing the actual records; do not arbitrarily merge identities.
3. Run `python backend/migrate_security.py --apply` only after that review.
   It normalizes emails, adds unique indexes, changes legacy `approved`
   memberships to pending and queues legacy content for moderation. Review these
   memberships and posts before opening community access. Existing `active`
   memberships still require an operator audit to confirm they were legitimate.
4. Deploy the API and matching client together. Old clients/tokens are incompatible
   with server-backed sessions. Notify users to sign in again and give admins time
   to review pending memberships and content. Do not restore the old authorization
   code as a rollback; use the database backup in a controlled staging rehearsal.
5. Run the isolation tests against an isolated real Mongo staging database and
   monitor failed/pending deletion jobs. A deletion response of 202 is queued,
   not completed. Verify eventual cleanup and Apple revocation before release.

## Required production configuration

| Component | Configuration |
| --- | --- |
| Backend | `ENVIRONMENT=production`, `MONGO_URL`, `DB_NAME`, random `JWT_SECRET` of at least 32 characters, exact `ALLOWED_ORIGINS` |
| Proxy | Enable `TRUST_PROXY_HEADERS=true` only behind a proxy that strips/replaces untrusted forwarded headers |
| Mobile | EAS production `EXPO_PUBLIC_BACKEND_URL=https://...`; public Maps key restricted to the intended applications/APIs |
| Website | `VITE_API_URL=https://...` at build time |
| Apple | Enable Sign in with Apple for `com.aurainfra.ai`; set `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` and persistent `APPLE_TOKEN_ENCRYPTION_KEY` (Fernet key) on the backend |
| Google | Configure the Emergent OAuth application for native `aurainfra://auth/login` and the website callback; verify that callback query state is preserved |
| Payments | Provider credentials, `PAYMENT_RETURN_ORIGIN` and `BACKEND_PUBLIC_URL` pointing to controlled HTTPS deployments |
| Recovery email | `SMTP_HOST`, `SMTP_FROM`, `SMTP_PORT` (default 587), `SMTP_USERNAME`/`SMTP_PASSWORD` if required; STARTTLS is mandatory unless `SMTP_SSL=true` uses TLS on port 465. Configure domain SPF/DKIM and test delivery; recovery is unavailable without this configuration. |
| AI | Production Emergent/provider credentials; verify contractual data retention and subprocessors match the policy |

Do not put Apple private keys, encryption keys or backend/provider secrets in Expo
public environment variables. Keep the Apple encryption key stable while stored
refresh tokens exist. This branch has no production credentials or signing keys.

## External steps still required for store submission

- Publish the three website pages and verify anonymous access at
  `https://aurainfra.ai/privacy-policy.html`, `/account-deletion.html` and
  `/community-standards.html`. Confirm `support@aurainfra.ai` receives requests,
  designate moderators and establish an actual response process. Code alone does
  not operate a moderation or deletion support service.
- Confirm the privacy text against the actual hosting, backups, payment and AI
  contracts. Define accounting/back-up retention periods for the operating
  jurisdiction. Complete App Store privacy labels and Google Play Data Safety
  from deployed behavior, including account identifiers, user content, photos,
  documents and third-party processing. Supply the deletion URL in Play Console.
- Configure EAS project ownership and signing credentials, Apple App Store Connect
  and Play Console app records. Produce signed IPA/AAB builds, inspect the merged
  release manifest and SDK privacy manifests, with Xcode 26 or later and the iOS 26 SDK or later. Verify the selected EAS
  image in its build logs against Apple’s current requirements. Local prebuild/export does not compile or sign a release binary.
- Test real Google login/cancellation/cold-start deep links on Android and iOS;
  Apple login, hidden email, account deletion and actual token revocation on iPhone;
  password recovery email delivery, expired/incorrect codes, session revocation and
  password account deletion; denied photo/camera permissions; AI consent refusal
  and revocation; document uploads; payments and webhook completion. Real provider
  credentials were unavailable during this implementation.
- Test on physical iPhone, Android and iPad (tablet support is enabled), including
  offline start, expired/revoked sessions, accessibility, keyboards and large text.
  Use TestFlight and Play internal testing, and satisfy the testing requirements
  shown for your specific developer account.
- Provide review credentials for an approved resident and a scoped moderator in
  a seeded demo community, plus clear review notes for moderation and deletion.
  Add current screenshots, support URL, age rating and accurate store descriptions.

## Policy sources checked

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
  (UGC, login services, deletion, privacy and third-party AI consent).
- [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
  (new apps and updates require API 36 from August 31, 2026).
- [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111).
- [Google Play UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937).

## Limits and remaining work

No production database, account settings, store records, signing identities or live
provider credentials were changed. The API URL used for local build verification
was a configuration sample; it does not confirm a deployed server at that address.
Native prebuild was performed in a separate temporary directory, not committed as
a native project. Native compilation, code signing, provider email/OAuth tests,
real Mongo concurrency and device layout remain release gates. Remaining lint
warnings include older effect dependencies, unused imports and intentional async
loading-state guidance; zero lint errors does not prove every screen is bug-free.

Apple SDK source: https://developer.apple.com/news/upcoming-requirements/
