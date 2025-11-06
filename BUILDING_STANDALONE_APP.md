# Building Standalone App with EAS Build

This guide walks you through building standalone iOS and Android apps for the AuraInfra.ai application.

## Prerequisites

### 1. Expo Account
- Create a free account at https://expo.dev/signup
- Log in to your account

### 2. Development Accounts (For Production Builds)
- **iOS:** Apple Developer Account ($99/year) - https://developer.apple.com/programs/
- **Android:** Google Play Console Account ($25 one-time fee) - https://play.google.com/console

## Step-by-Step Build Process

### Step 1: Login to Expo Account

```bash
cd /app/frontend
eas login
```

Enter your Expo username and password when prompted.

### Step 2: Configure Your Project

The project is already configured with `eas.json`. Review the configuration:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "distribution": "store",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### Step 3: Update app.json with Store Information

Before building for production, update `/app/frontend/app.json`:

```json
{
  "expo": {
    "name": "AuraInfra.ai",
    "slug": "aurainfra-ai",
    "version": "1.0.1",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.aurainfra.ai",
      "buildNumber": "2"
    },
    "android": {
      "package": "com.aurainfra.ai",
      "versionCode": 2
    }
  }
}
```

### Step 4: Build Commands

#### A. Preview Build (Recommended for Testing)

**Android APK (can install directly on device):**
```bash
cd /app/frontend
eas build --profile preview --platform android
```

**iOS Simulator Build (for testing on Mac):**
```bash
cd /app/frontend
eas build --profile preview --platform ios
```

#### B. Production Build (For App Stores)

**Android (Google Play Store):**
```bash
cd /app/frontend
eas build --profile production --platform android
```

**iOS (Apple App Store):**
```bash
cd /app/frontend
eas build --profile production --platform ios
```

**Both Platforms:**
```bash
cd /app/frontend
eas build --profile production --platform all
```

### Step 5: Monitor Build Progress

After running the build command:
1. EAS will provide a build URL (e.g., https://expo.dev/accounts/[username]/projects/aurainfra-ai/builds/[build-id])
2. Open this URL in your browser to monitor progress
3. Build typically takes 10-30 minutes depending on platform and queue

### Step 6: Download and Test

Once the build completes:

**For Android APK:**
- Download the .apk file from the build URL
- Transfer to your Android device
- Enable "Install from Unknown Sources" in Android settings
- Install the APK

**For iOS:**
- Download the .ipa file (requires Mac with Xcode)
- Use Xcode or Apple Configurator to install on device
- Or submit to TestFlight for distribution

## Important Notes

### Environment Variables

The app uses these environment variables from `.env`:
```
EXPO_PUBLIC_BACKEND_URL=https://hoa-portal-fixes.emergent.host
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyAKpmba-0cD6Mrtgq1HWztqk0Scp5RV9KI
```

These are automatically included in the build.

### API Keys and Certificates

**For iOS Production:**
You'll need:
- Apple Developer Account credentials
- Push Notification certificates (if using notifications)
- EAS will guide you through certificate generation

**For Android Production:**
You'll need:
- Google Play Console account
- Upload keystore (EAS can generate this automatically)

### Build Profiles Explained

1. **development**: Creates a debug build with development tools
2. **preview**: Creates a production-like build for testing (APK for Android, not for App Store)
3. **production**: Creates optimized build ready for store submission

## Quick Start Commands

### First Time Build (Preview for Testing):
```bash
# Android
cd /app/frontend
eas login
eas build --profile preview --platform android

# iOS (requires Mac for installation)
cd /app/frontend
eas login
eas build --profile preview --platform ios
```

### Production Build (For Stores):
```bash
cd /app/frontend
eas login
eas build --profile production --platform android
# or
eas build --profile production --platform ios
```

## Troubleshooting

### Build Fails:
- Check build logs at the provided URL
- Ensure all dependencies are compatible
- Verify bundle identifier is unique (iOS) and package name (Android)

### App Crashes After Install:
- Check environment variables are correct
- Verify backend URL is accessible
- Review crash logs in Xcode (iOS) or logcat (Android)

### Can't Install APK:
- Enable "Install from Unknown Sources" in Android settings
- Check device storage space
- Verify APK downloaded completely

## Submitting to App Stores

### Android (Google Play):
```bash
cd /app/frontend
eas submit -p android
```

### iOS (Apple App Store):
```bash
cd /app/frontend
eas submit -p ios
```

EAS will guide you through the submission process.

## Alternative: Local Builds

If you prefer to build locally (requires more setup):

**Android:**
```bash
cd /app/frontend
npx expo run:android --variant release
```

**iOS (requires Mac):**
```bash
cd /app/frontend
npx expo run:ios --configuration Release
```

## Resources

- EAS Build Documentation: https://docs.expo.dev/build/introduction/
- EAS Submit Documentation: https://docs.expo.dev/submit/introduction/
- Expo Forums: https://forums.expo.dev/
- Build Status: https://expo.dev/accounts/[your-username]/projects/aurainfra-ai/builds

## Support

For build issues:
1. Check the build logs at the provided URL
2. Review Expo documentation
3. Search Expo forums
4. Contact Expo support through the dashboard
