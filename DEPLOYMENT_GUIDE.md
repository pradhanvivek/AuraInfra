# AuraInfra.ai Deployment Guide

## 📋 Overview
This guide covers deploying AuraInfra.ai as both a **web application** and **mobile apps** (iOS & Android).

---

## ✅ Current Configuration Status

### App Configuration (app.json)
✅ **Name**: AuraInfra.ai  
✅ **Slug**: aurainfra-ai  
✅ **Version**: 1.0.2  
✅ **iOS Bundle ID**: com.aurainfra.ai  
✅ **Android Package**: com.aurainfra.ai  
✅ **Web Configuration**: Configured with Metro bundler and static output  
✅ **Expo Router**: Enabled  
✅ **Icons & Splash**: Configured  

### Environment Variables
✅ **Backend URL**: Configured  
✅ **Google Maps API Key**: Configured  
✅ **Metro Cache**: Optimized  

---

## 🌐 Web Deployment

### Option 1: Static Web Export (Recommended for Hosting Services)

#### Step 1: Build Web Bundle
```bash
cd /app/frontend
npx expo export --platform web
```

This creates a `dist` folder with static HTML/CSS/JS files.

#### Step 2: Deploy to Hosting Service

**Netlify:**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
cd dist
netlify deploy --prod
```

**Vercel:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd dist
vercel --prod
```

**AWS S3 + CloudFront:**
```bash
# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Set up CloudFront distribution pointing to the S3 bucket
```

**Firebase Hosting:**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize and deploy
firebase init hosting
firebase deploy
```

#### Step 3: Environment Variables for Production
Create a production `.env` file:
```bash
EXPO_PUBLIC_BACKEND_URL=https://your-backend-api.com
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

---

### Option 2: Current Preview (Development/Testing)

Your app is **already accessible on web** at:
```
https://aurainfra-docfix.preview.emergentagent.com
```

This is running via `expo start` and is great for development but **not suitable for production**.

---

## 📱 Mobile App Deployment

### Prerequisites
1. **Expo Account**: Create at https://expo.dev
2. **Apple Developer Account**: For iOS ($99/year)
3. **Google Play Developer Account**: For Android ($25 one-time)

---

### Option 1: Expo Application Services (EAS) - Recommended

#### Setup EAS
```bash
cd /app/frontend

# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure
```

#### Build for iOS
```bash
# Development build (for testing)
eas build --platform ios --profile development

# Production build (for App Store)
eas build --platform ios --profile production
```

#### Build for Android
```bash
# Development build (APK for testing)
eas build --platform android --profile preview

# Production build (AAB for Google Play)
eas build --platform android --profile production
```

#### Submit to App Stores
```bash
# iOS App Store
eas submit --platform ios

# Google Play Store
eas submit --platform android
```

---

### Option 2: Expo Go (Quick Testing - No Build Required)

Users can test your app immediately using Expo Go:

1. **Publish Update**:
```bash
cd /app/frontend
npx expo publish
```

2. **Share Link**: Users scan QR code with Expo Go app
   - **iOS**: Download Expo Go from App Store
   - **Android**: Download Expo Go from Google Play

**Note**: This is for testing only, not for production distribution.

---

## 🔧 Configuration Checklist

### Before Production Deployment

#### 1. Update app.json
```json
{
  "expo": {
    "name": "AuraInfra.ai",
    "slug": "aurainfra-ai",
    "version": "1.0.2", // Increment for updates
    "privacy": "public", // or "unlisted"
    "orientation": "portrait",
    "extra": {
      "eas": {
        "projectId": "your-project-id" // Get from eas build:configure
      }
    }
  }
}
```

#### 2. Update Environment Variables
Create separate `.env` files:

**.env.production** (for web deployment):
```env
EXPO_PUBLIC_BACKEND_URL=https://api.aurainfra.ai
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_production_key
```

**.env.development** (for local development):
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_dev_key
```

#### 3. Update eas.json for Mobile Builds

Add environment variables to EAS:
```json
{
  "build": {
    "production": {
      "distribution": "store",
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://api.aurainfra.ai"
      }
    }
  }
}
```

#### 4. Backend Configuration

Ensure your backend is deployed and accessible:
- **Backend URL**: Should be publicly accessible
- **CORS**: Configure to allow your web domain
- **SSL**: Use HTTPS for production

---

## 🚀 Complete Deployment Steps

### For Web Production:

```bash
# 1. Build web bundle
cd /app/frontend
npx expo export --platform web

# 2. The dist folder is ready for deployment
# Upload to your hosting service of choice

# 3. Configure domain and SSL
# Point your domain to the hosting service
# Enable HTTPS (most services do this automatically)
```

### For Mobile Apps:

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Login
eas login

# 3. Configure
cd /app/frontend
eas build:configure

# 4. Build iOS
eas build --platform ios --profile production

# 5. Build Android  
eas build --platform android --profile production

# 6. Download builds or submit directly
eas submit --platform ios
eas submit --platform android
```

---

## 📦 Required Assets for App Stores

### iOS App Store Requirements:
- ✅ App Icon (1024x1024px)
- ✅ Screenshots (various iPhone sizes)
- ✅ Privacy Policy URL
- ✅ App Description
- ✅ Keywords
- ✅ Support URL

### Google Play Store Requirements:
- ✅ App Icon (512x512px)
- ✅ Feature Graphic (1024x500px)
- ✅ Screenshots (minimum 2)
- ✅ Privacy Policy URL
- ✅ App Description
- ✅ Content Rating

---

## 🔒 Security Considerations

### 1. API Keys
- ✅ Google Maps API Key: Restrict by domain/app
- ✅ Backend API: Use authentication tokens
- ✅ Don't commit sensitive keys to Git

### 2. Backend Security
- ✅ Enable CORS with specific origins
- ✅ Use HTTPS only
- ✅ Implement rate limiting
- ✅ Secure MongoDB connection

### 3. App Security
- ✅ Use secure storage for tokens (AsyncStorage for web, SecureStore for mobile)
- ✅ Implement proper session management
- ✅ Validate all user inputs

---

## 🎯 Recommended Deployment Strategy

### Phase 1: Web Deployment (Immediate)
1. Export static web build
2. Deploy to Vercel/Netlify (free tier available)
3. Configure custom domain
4. Test thoroughly

### Phase 2: Mobile App (TestFlight/Internal Testing)
1. Build with EAS (development profile)
2. Distribute via TestFlight (iOS) or internal testing (Android)
3. Gather feedback
4. Fix bugs

### Phase 3: App Store Submission
1. Build production versions
2. Prepare store listings
3. Submit for review
4. Launch!

---

## 📊 Deployment URLs Structure

### Development:
- Web: `https://aurainfra-docfix.preview.emergentagent.com` (current)
- Mobile: Expo Go app

### Production:
- Web: `https://app.aurainfra.ai` (your domain)
- iOS: App Store
- Android: Google Play Store

---

## 🛠️ Maintenance & Updates

### Web Updates:
```bash
# Build new version
npx expo export --platform web

# Deploy to hosting service
# (varies by service)
```

### Mobile Updates:

**Over-the-Air (OTA) Updates** (for minor changes):
```bash
eas update --branch production --message "Bug fixes"
```

**New Build Required** (for native changes):
```bash
# Increment version in app.json
# Build new version
eas build --platform all --profile production
# Submit to stores
```

---

## 📞 Support Resources

- **Expo Documentation**: https://docs.expo.dev
- **EAS Build**: https://docs.expo.dev/build/introduction/
- **Expo Router**: https://docs.expo.dev/router/introduction/
- **App Store Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **Google Play Policies**: https://play.google.com/console/about/guides/

---

## ✅ Checklist Summary

### Web Deployment Ready:
- [x] Web configuration in app.json
- [x] Metro bundler configured
- [x] Static output enabled
- [x] Environment variables configured
- [x] Backend API accessible

### Mobile Deployment Prep:
- [x] App identifiers configured
- [x] Icons and splash screens present
- [x] EAS configuration file exists
- [ ] Expo account created (you need to do this)
- [ ] App store accounts (if submitting to stores)

### Next Steps:
1. Choose web hosting service
2. Export and deploy web version
3. Create Expo account for mobile builds
4. Test thoroughly on all platforms
5. Submit to app stores (optional)

---

**Your app is well-configured and ready for deployment! 🎉**
