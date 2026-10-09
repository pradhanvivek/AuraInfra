# AuraInfra community and asset app

## Implemented in this branch

- Exactly two visible main tabs: Community and My Assets.
- Community home with membership selection, existing visitors, dues, complaints,
  community board, amenity bookings, meetings and documents.
- Existing personal asset portfolio, AI scanning and identification, vehicles,
  appliances, jewelry, furniture, art and property functionality preserved.
  Legacy property tools are available from My Assets.
- Account, notifications and administration are accessed from the header.
- Platform administrator module-settings screen; no app rebuild for flag changes.
- Association-curated local services: laundry, car wash, food, repairs, other.
  Administrators publish/retire listings; residents request bookings; managers
  confirm, start and complete fulfillment with a recorded note. Residents may
  cancel their own unconfirmed requests. Requests are not confirmed reservations.
- SOP templates, manual assignment to active community members, deadlines,
  evidence per step, submission, administrator approval/reopening, activity history.
  The mobile creation flow sets an initial 24-hour deadline; API supports any future
  timezone-aware deadline. Reopening resets the checklist and preserves history.
- Community authorization, scoped queries, state-transition validation and
  optimistic concurrency checks on SOP and booking updates.
- Account deletion removes personal booking requests and removes actor references
  and evidence from retained association workflow records.

## Database flags

MongoDB collection: `app_configuration`; document `_id`: `resident-app`.

```javascript
db.app_configuration.updateOne(
  { _id: "resident-app" },
  { $set: { community: true, assets: true } },
  { upsert: true }
)
```

Both flags default to true when no document exists. Values must be BSON booleans;
malformed manual values fall back to that key's default. The authenticated
`GET /api/app-config` returns only these two booleans. Platform super admins can
replace both flags through `PUT /api/admin/super/app-config` or App settings.
The settings endpoint records the actor and update time. Direct DB edits must be
limited to trusted operators; they do not pass through API validation/audit.

| community | assets | Main navigation |
|---|---|---|
| true | true | Community and My Assets |
| true | false | Community |
| false | true | My Assets |
| false | false | Unavailable screen, with account and retry access |

The app fetches flags on sign-in, every 30 seconds while active, and on foreground.
Disabled module deep links redirect to an enabled tab. A failed refresh blocks
module content with a retry screen; there is no persisted flag cache. Account and
App settings remain available for recovery even when both tabs are disabled.
These flags control mobile module visibility, not backend authorization or data
retention. API permissions still apply independently. Scope is deployment-wide;
per-community entitlements and per-user rollout are not implemented.

Deploy the backend before distributing the new mobile build: old deployments do
not have `/api/app-config`, and the new app intentionally blocks module content
when that endpoint cannot be loaded. One initial mobile/store release is needed;
subsequent visibility changes require no rebuild or deployment.

## App structure

One resident application with role-specific guard and association interfaces,
sharing the existing authentication/backend. Existing visitor management and
administration are reused. No separate guard/vendor binaries were created;
separate apps are warranted when offline guard operations and dedicated vendor
workflows are implemented and validated, not simply to provide two resident tabs.

## Remaining work before a production pilot

- Offline-first guard interface, conflict reconciliation and notification/device QA.
- Recurring SOP scheduling, escalations/notifications, photo/document evidence, reassignment and configurable approval chains.
- Service catalogue pagination/search, provider onboarding and dedicated vendor
  access, recurring bookings, payment/refund/reconciliation and disputes.
- External food/delivery provider agreements and integrations; no third-party
  order API or automatic vendor dispatch exists in this branch.
- Full society accounting and procurement; existing dues/payment features are reused.
- Deployment, physical-device testing and an association pilot. Live MongoDB
  flags and vendor records were not changed during development.

## Verification

```bash
python -m pip install -r backend/requirements-test.txt
python -m pytest backend/tests -q --disable-warnings
cd frontend
npm ci
npm run typecheck
npm run test:security
npm run lint
npx expo export --platform android --platform ios --output-dir /tmp/aurainfra-superapp-bundles
```
