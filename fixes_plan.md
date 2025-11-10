# Fixes Plan

## Issue 1: Show property name consistently on all My Property pages
- Files to update:
  - property-documents/[id].tsx
  - property-fixtures/[id].tsx  
  - property-measurements/[id].tsx
  - property-vastu/[id].tsx
  - property-health/[id].tsx
  - property-paint-estimate/[id].tsx
- Solution: Fetch property data and display property name in header

## Issue 2: Notifications back button navigation
- File: app/(tabs)/notifications.tsx
- Current: router.back() goes to previous page (assets)
- Solution: Change to router.push('/(tabs)/dashboard') or router.push('/(tabs)')

## Issue 3: Properties page guide X button too close to header
- Files: components/AppTour.tsx or components/PageDemo.tsx
- Solution: Adjust positioning/margin for X button

## Issue 4: Admin dashboard as separate tab
- File: app/(tabs)/_layout.tsx
- Solution: Add admin tab to bottom navigation, remove from profile

## Issue 5: Community name on admin dashboard
- Depends on whether admin dashboard is in mobile app or web
- Need to check if this is website or mobile app admin

## Issue 6: Increase logo size in properties header
- File: app/(tabs)/index.tsx
- Current: 40x40
- Solution: Increase to 56x56 or 60x60
