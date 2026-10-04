# AuraInfra.ai store submission draft

These drafts describe the current implementation. Complete the release gates in
STORE_READINESS.md before submitting. Do not claim successful provider/device
verification until it has been performed on the signed release.

## Listing copy

**App name:** AuraInfra.ai

**Apple subtitle:** Manage Assets and Communities

**Google short description:** Organize assets and manage your residential community in one place.

**Description:**

Keep property and personal asset information together with AuraInfra.ai. Organize
properties, vehicles, appliances, furniture, jewelry and art, and attach photos,
receipts and documents to the records you maintain.

Track maintenance and warranty information, review your asset portfolio, and use
optional AI tools to help extract details or estimate property requirements.
AI analysis requires your permission before selected information is sent to the
processing services identified in the app. Review AI results before saving or
making decisions; estimates are not certified valuations or professional advice.

Approved community members can access their residential community's documents,
visitor records, amenity bookings, meetings, complaints, maintenance charges and
community board. Available actions depend on your membership and role. Community
administrators review membership applications and moderate posts and comments
before publication. Members can report content and block users.

Create a password account or use a supported sign-in provider. Password recovery,
privacy choices and account deletion are available within the app.

AuraInfra.ai is a product of Jash Vish Infratech Private Limited.
Support: support@aurainfra.ai

## Public resources

Publish and verify anonymous access before submission:

- Privacy: https://aurainfra.ai/privacy-policy.html
- Account deletion: https://aurainfra.ai/account-deletion.html
- Community standards: https://aurainfra.ai/community-standards.html
- Support contact: support@aurainfra.ai (verify the mailbox receives requests).

Use an actual support page or your working support website as Apple's Support URL;
a mailto link is an in-app contact action, not a substitute for a public support URL.

## Reviewer notes draft

AuraInfra.ai manages physical assets and residential community operations. HOA
payments relate to community maintenance/services and do not unlock digital app
features. AI estimates require explicit consent; manual asset entry is available.

Supply two actual, working password demo accounts through the private store-review
credential fields: an approved resident and a scoped community administrator.
Use an isolated demonstration community with synthetic records. Do not put the
passwords in this file or commit them to git. Keep the backend and demo accounts
available throughout review.

Suggested review path:

1. Sign in as the resident and accept the first-use disclaimer.
2. Inspect a seeded property/asset and add a record manually.
3. Open community features from the community selection screen. Verify the resident
   can access their approved community but cannot administer another community.
4. Open the community board, accept community standards, submit a post, and inspect
   report/block actions on seeded approved content. Posts are queued for review.
5. Sign in as the scoped admin, open Admin → Moderation, and approve the test post.
6. Open Profile for privacy, support, AI-consent revocation, membership status and
   account deletion. For deletion, use a separate disposable review account so
   the main reviewer credentials remain usable. Confirm its password, then delete.
7. On Login, select Forgot password for a demo email mailbox under your control.
   State how the reviewer can obtain the email code without exposing your real
   mailbox credentials. Also validate Google login and Apple login with configured
   providers on physical devices before submission.

## Console declarations and screenshots

Complete privacy labels and Data Safety from deployed data flows. Account
identifiers, user content, photos/documents, community records, payments, optional
AI processing and diagnostic handling need review; do not declare “no data
collected.” Distinguish provider processing and sharing from data sold or used for
advertising. Verify retention and backup behavior with the actual providers.

Declare user-generated content and complete the current age-rating questionnaires.
Do not select a children's category without a separately designed children's flow.
Choose categories from the actual store-console options, with Productivity or
Business as candidates for this asset/community management product.

Capture screenshots from the signed, seeded app for the supported iPhone, iPad
and Android form factors. Include asset management, community functions and
settings. Avoid real residents, addresses, visitor phone numbers, receipts,
payment details or documents in marketing screenshots.
