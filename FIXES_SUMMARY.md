# Fixes Applied

## Issue 1: Disclaimer showing repeatedly
- Root cause: index.tsx checks disclaimer_accepted every time app navigates to home
- Fix: Update index.tsx to only check disclaimer once per session using AsyncStorage

## Issue 2: Android terms text fully bolded
- Root cause: Text style inconsistency between platforms
- Fix: Update disclaimer.tsx text styling for consistent rendering

## Issue 3: Home screen tile titles broken on Android
- Root cause: Title text not constraining properly
- Fix: Add numberOfLines and flexShrink to tile text styles

## Issue 4: Page titles trimmed on Android
- Root cause: Header configuration not accounting for Android status bar
- Fix: Update header styles with proper padding

## Issue 5: "My dues" routing to unmatched route
- Root cause: Route pointing to '/dues/index' instead of '/dues'
- Fix: Update route in dashboard tiles

## Issue 6: Header spacing issues on Android
- Root cause: SafeAreaView edges and header sizing not optimized for Android
- Fix: Platform-specific header styling and proper SafeAreaView configuration
