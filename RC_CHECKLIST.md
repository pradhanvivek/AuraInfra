# AuraInfra iOS + Android Release Candidate Checklist

## Automated gate
From `frontend/`, run `npm ci && npm run rc:check`.
GitHub Actions runs the same mobile RC check plus backend security tests and the website production build.

## Release identity
- App version: 1.0.2
- iOS bundle identifier: com.aurainfra.ai
- Android application ID: com.aurainfra.ai
- Deep-link scheme: aurainfra
- Production Android artifact: AAB
- EAS remotely manages and auto-increments store build numbers.

Do not change either store identifier after creating the store records.

## Required before signed builds
- Link this repository to the real Expo/EAS project (`eas init`) and commit the generated EAS project identity.
- Confirm the Expo organization/account that owns the app.
- Configure the production EAS environment with `EXPO_PUBLIC_BACKEND_URL` and, only if overridden, `EXPO_PUBLIC_AUTH_URL`.
- Configure iOS distribution/App Store Connect credentials and the Sign in with Apple capability.
- Configure Android Play signing credentials.
- Keep backend/provider secrets out of EXPO_PUBLIC_* variables.

## Required device smoke test
Test the signed candidate on a physical iPhone and Android device:
1. Fresh install, password login/logout and relaunch.
2. Google login, cancellation and cold-start callback.
3. Apple login on iPhone, including Hide My Email.
4. Account deletion for password, Google and Apple accounts.
5. Community onboarding and isolation between two communities/unrelated users.
6. Camera denied/allowed; system photo picker; document upload/view.
7. AI consent accept, reject and revoke.
8. Offline launch, network recovery and expired/revoked session.
9. Payments/webhook completion in the intended environment.
10. Large text, keyboard, dark mode and primary screens.

## Store web prerequisites
Verify the privacy policy, account deletion and community standards pages are publicly accessible without authentication.

## RC promotion rule
Do not merge the release branch or submit a binary until CI is green at the exact candidate SHA, signed iOS and Android builds are generated from that SHA, physical-device smoke tests pass, production backend/database migration and provider configuration are verified, and store privacy/data-safety declarations match deployed behavior.
