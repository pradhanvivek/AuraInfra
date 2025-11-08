# AuraInfra.ai Beta Testing Runbook 📚

**Version**: 1.0  
**Last Updated**: November 2024  
**For**: Beta Test Customers

---

## Table of Contents

1. [Quick Start Guide](#quick-start-guide)
2. [Feature Walkthrough](#feature-walkthrough)
3. [Step-by-Step Testing Guide](#step-by-step-testing-guide)
4. [Troubleshooting](#troubleshooting)
5. [FAQ](#faq)
6. [How to Report Issues](#how-to-report-issues)

---

## Quick Start Guide

### Accessing the App

**Web Access** (Recommended for Beta Testing):
- **URL**: https://hoa-portal-fixes.emergent.host/
- **Best Browser**: Safari on iPhone/iPad or Chrome on Desktop
- **Device**: Works on mobile and desktop

### First Time Setup

1. **Open the app** in your browser
2. **Click "Register"** on the login screen
3. **Fill in your details**:
   - Username (choose any unique name)
   - Email address
   - Password (at least 8 characters)
4. **Click "Register"** to create your account
5. **Login** with your credentials

✅ **Success**: You should see the Dashboard with various tiles

---

## Feature Walkthrough

### 1. Dashboard Overview

After logging in, you'll see your main dashboard with tiles for:

- **Properties** 🏠 - Manage your real estate
- **Assets** 📦 - Quick access to all assets
- **Portfolio** 💼 - View total valuation
- **Notifications** 🔔 - Warranty reminders
- **Profile** 👤 - Your account settings

**Pro Tip**: Tap any tile to navigate to that section

---

### 2. Managing Properties

#### Add Your First Property

1. **Tap "Properties"** on the dashboard
2. **Tap the "+" button** (Add Property)
3. **Fill in property details**:
   - Property Name (e.g., "My Home")
   - Complete Address
   - Purchase Cost (optional)
   - Current Value (optional)
4. **Tap "Save"**

#### Property Features

**Documents Tab**:
- Upload property documents, photos, deeds
- Click "Upload Document"
- Choose file from your device
- Add a name and select category
- Uploaded documents appear in the list

**Measurements Tab**:
- Add room dimensions
- Select room type
- Enter measurements
- Optionally upload floor plan image
- **Try AI Floor Plan**: Upload a floor plan and get AI analysis!

**Fixtures Tab**:
- Add appliances and fixtures
- Track warranty information
- Set maintenance schedules

**Near Me Tab**:
- See nearby amenities (hospitals, schools, restaurants)
- View distance and get directions
- Powered by OpenStreetMap

---

### 3. Managing Assets

#### Vehicle Management 🚗

1. **Go to Dashboard → Assets → Vehicles**
2. **Add Vehicle**:
   - **Manual Entry**: Fill in details manually
   - **AI Scan**: Upload a photo and let AI identify your vehicle!
3. **Track**:
   - Make, Model, Year
   - Registration and VIN
   - Insurance details
   - Maintenance schedule

**AI Scan Feature**:
- Click "AI Scan Artwork" button
- Upload vehicle photo
- Wait a few seconds
- AI fills in make, model, year automatically
- Review and complete remaining details

#### Appliances Management 📱

1. **Go to Assets → Appliances**
2. **Add Appliance**:
   - Use AI scan for quick entry
   - Upload product photo
   - AI identifies brand, model, serial number
3. **Track Warranty**:
   - Expiry date
   - Get reminders before expiry
   - Upload warranty documents

#### Jewelry Collection 💍

1. **Go to Assets → Jewelry**
2. **Add Jewelry Item**:
   - Type (Ring, Necklace, Bracelet, etc.)
   - Metal type (Gold, Silver, Platinum)
   - Stones/Gems description
   - Weight and purity
3. **Track Appraisals**:
   - Current appraisal value
   - Appraisal date
   - Certificate number
   - Upload certificate photo

#### Furniture & Art 🪑🎨

**Furniture**:
- Category, Brand, Material
- Style and condition
- Purchase information
- Photos

**Art Collection**:
- Artist name
- Type (Painting, Sculpture, etc.)
- Medium (Oil, Acrylic, etc.)
- Provenance tracking
- Appraisal values
- **AI Scan**: Upload artwork photo for automatic identification

---

### 4. Portfolio & Reports

#### View Portfolio Summary

1. **Tap "Portfolio"** on dashboard
2. **See Overview**:
   - Total asset value
   - Breakdown by category
   - Visual pie chart
   - Item counts

#### Generate PDF Reports

**Standard Portfolio Report**:
1. In Portfolio screen, tap "Generate PDF"
2. Wait for generation
3. PDF opens in new tab (web) or downloads (mobile)
4. Contains summary, breakdown, and stats

**Insurance Report** (Premium Feature):
1. Tap "Generate Insurance Report"
2. **Select Assets**:
   - Choose specific items to include
   - Or select all
3. **Add Notes** (optional):
   - Custom message for insurance
   - Special instructions
4. **Generate**:
   - Includes detailed asset info
   - Photos at optimized resolution
   - Appraisal certificates
   - Invoice details
   - Legal disclaimer

---

### 5. HOA Features (If Applicable)

#### Community Board

- View announcements
- Filter by category
- See upcoming events
- Check bulletin board

#### HOA Documents

- Access governing documents
- Bylaws and rules
- Meeting minutes
- Filter by category

#### Amenities

- View available amenities
- Check availability
- See booking rules
- Book amenities (if enabled)

#### Meetings & Events

- Upcoming HOA meetings
- Meeting details (date, time, location, agenda)
- RSVP functionality
- View past meetings

#### Visitors Management

- Register expected visitors
- Set visit dates
- Track visitor history

---

## Step-by-Step Testing Guide

### Test Scenario 1: Property Setup (10 mins)

**Goal**: Add a property with documents

1. ✅ Register/Login
2. ✅ Add a property with name and address
3. ✅ Upload at least one document
4. ✅ View the uploaded document
5. ✅ Navigate back to properties list

**Expected**: Property appears in list, document is viewable

---

### Test Scenario 2: Asset with AI Scan (15 mins)

**Goal**: Use AI to add an asset

1. ✅ Go to Assets → Choose any asset type
2. ✅ Tap "Add" button
3. ✅ Look for "AI Scan" button
4. ✅ Upload/Take photo of item
5. ✅ Wait for AI processing
6. ✅ Review auto-filled information
7. ✅ Complete remaining fields
8. ✅ Save the asset

**Expected**: Asset details auto-populate, can save successfully

---

### Test Scenario 3: Portfolio Report (5 mins)

**Goal**: Generate and view portfolio report

1. ✅ Add at least 2 assets (any type)
2. ✅ Go to Portfolio
3. ✅ Verify total value calculation
4. ✅ Tap "Generate PDF"
5. ✅ Wait for PDF generation
6. ✅ View/Download PDF

**Expected**: PDF contains all your assets with correct values

---

### Test Scenario 4: Warranty Tracking (5 mins)

**Goal**: Set up warranty reminders

1. ✅ Add an appliance with warranty
2. ✅ Set warranty expiry date
3. ✅ Go to Profile → Settings
4. ✅ Check warranty reminder preference
5. ✅ Go to Notifications
6. ✅ Check if warranty notification appears

**Expected**: System tracks warranties and shows notifications

---

### Test Scenario 5: Navigation Test (5 mins)

**Goal**: Ensure smooth navigation

1. ✅ From Dashboard, visit each main section
2. ✅ Go to a detail page
3. ✅ Use back button to return
4. ✅ Switch between tabs (if applicable)
5. ✅ Logout and login again

**Expected**: No broken links, back button works, session persists

---

## Troubleshooting

### Common Issues & Solutions

#### Issue 1: "Can't Upload Document/Image"

**Symptoms**: Upload button doesn't work or shows error

**Solutions**:
- ✅ Check file size (keep under 10MB)
- ✅ Try different file format (JPG, PNG, PDF)
- ✅ Close and reopen the app
- ✅ Try on different browser/device
- ✅ Clear browser cache

#### Issue 2: "AI Scan Not Working"

**Symptoms**: Scan button doesn't respond or shows error

**Solutions**:
- ✅ Ensure good photo quality (clear, well-lit)
- ✅ Take photo straight-on, not at angle
- ✅ Wait 10-15 seconds for processing
- ✅ Try a different photo
- ✅ Fall back to manual entry if needed

#### Issue 3: "PDF Won't Generate"

**Symptoms**: PDF generation fails or doesn't download

**Solutions**:
- ✅ Check you have at least one asset added
- ✅ Try again after 30 seconds
- ✅ Allow pop-ups in browser settings
- ✅ Check download folder
- ✅ Try different browser

#### Issue 4: "Login Issues"

**Symptoms**: Can't login with credentials

**Solutions**:
- ✅ Double-check username/password (case-sensitive)
- ✅ Try "Forgot Password" if available
- ✅ Register new account if needed
- ✅ Clear cookies and try again

#### Issue 5: "Page Not Loading"

**Symptoms**: Blank screen or loading forever

**Solutions**:
- ✅ Check internet connection
- ✅ Refresh the page (pull down or F5)
- ✅ Clear browser cache
- ✅ Try different browser
- ✅ Restart your device

#### Issue 6: "Changes Not Saving"

**Symptoms**: Edits don't persist after saving

**Solutions**:
- ✅ Wait for "Success" message before navigating away
- ✅ Check internet connection
- ✅ Try saving again
- ✅ Take screenshot and report

---

## FAQ

### General Questions

**Q: Is my data secure?**  
A: Yes! All data is encrypted and stored securely. Only you can access your information.

**Q: Can I access from multiple devices?**  
A: Yes! Login from any device with your credentials.

**Q: Will my test data be deleted?**  
A: No! Your data will be preserved after launch.

**Q: How much data can I store?**  
A: No limits during beta testing. Add as much as you'd like!

### Feature Questions

**Q: How accurate is the AI scanning?**  
A: AI is 80-90% accurate. Always review and correct auto-filled information.

**Q: What file formats are supported?**  
A: Images (JPG, PNG), Documents (PDF). More formats coming soon.

**Q: Can I edit an asset after adding?**  
A: Yes! Tap on any asset to view details, then tap "Edit" button.

**Q: How do I delete something?**  
A: On the detail page, look for "Delete" button (usually at bottom).

**Q: Can I track multiple properties?**  
A: Yes! Add as many properties as you own.

### Technical Questions

**Q: Which browsers are supported?**  
A: Safari (iOS/Mac), Chrome, Edge, Firefox. Safari recommended for iPhone.

**Q: Do I need to install an app?**  
A: No! It works directly in your browser. Native app coming soon.

**Q: Why is AI scan slow sometimes?**  
A: AI processing takes 5-15 seconds. Complex images may take longer.

**Q: Can I use offline?**  
A: Not yet. Internet connection required for all features.

---

## How to Report Issues

### What to Include in Bug Reports

When reporting an issue, please provide:

1. **Description**:
   - What you were trying to do
   - What happened
   - What you expected to happen

2. **Device & Browser**:
   - Device (iPhone 14, iPad, Windows PC, etc.)
   - Browser (Safari, Chrome, etc.)
   - Operating System (iOS 17, Windows 11, etc.)

3. **Steps to Reproduce**:
   - Step 1: I clicked on...
   - Step 2: Then I...
   - Step 3: Error appeared

4. **Screenshot** (Very Helpful!):
   - Take screenshot of the issue
   - Include it in your report

5. **Severity**:
   - 🔴 Critical: Can't use the app
   - 🟡 Major: Feature doesn't work
   - 🟢 Minor: Small issue or typo

### Sending Your Report

**Email Format**:
```
Subject: Bug Report - [Brief Description]

Bug Description:
[Explain what happened]

Device/Browser:
[Your device and browser info]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Expected Behavior:
[What should have happened]

Actual Behavior:
[What actually happened]

Screenshots:
[Attach screenshots if possible]

Severity: [Critical/Major/Minor]
```

**Send To**: [Your Email]

---

## Testing Tips

### Best Practices

✅ **Do**:
- Test one feature at a time
- Try on different devices if possible
- Report even small issues
- Be specific in feedback
- Experiment with different scenarios
- Test edge cases (very long names, special characters, etc.)

❌ **Don't**:
- Rush through testing
- Assume something works without trying
- Skip reporting "minor" issues
- Use sensitive/real data if you're uncomfortable

### What Makes Good Feedback

**Poor Feedback**:
- "It doesn't work"
- "Something is broken"

**Good Feedback**:
- "When I try to upload a PDF larger than 5MB in the Documents section, I get an error message 'Upload failed'. Using Safari on iPhone 14."
- "The AI scan works great! It correctly identified my Toyota Camry 2020. However, it missed the VIN number."

---

## Quick Reference

### Key URLs
- **App**: https://hoa-portal-fixes.emergent.host/
- **Support Email**: [Your Email]

### Support Contacts
- **Technical Issues**: [Your Email]
- **Feature Questions**: [Your Email]
- **Urgent Issues**: [Your Phone]

### Testing Timeline
- **Start Date**: [Date]
- **Feedback Deadline**: [Date]
- **Estimated Time**: 30-45 minutes

---

## Thank You!

Your thorough testing and honest feedback are invaluable. Every bug you find and every suggestion you make helps us create a better product for everyone.

**Happy Testing!** 🎉

---

**Document Version**: 1.0  
**Last Updated**: November 2024  
**Questions?**: Contact us anytime!
