# Insurance Report Feature - Implementation Plan

## Overview
Comprehensive insurance report generation with asset selection, custom notes, and image inclusion.

## Key Features Implemented

### 1. Asset Selection Modal
- Checkbox interface to select specific assets
- Select All / Deselect All functionality
- Category-wise grouping
- Real-time count of selected items

### 2. Custom Notes Input
- Optional insurance notes field
- Purpose: Additional descriptions for insurance claims
- Character limit: 1000 characters

### 3. Enhanced PDF Generation

#### A. Executive Summary Section
- Total portfolio value
- Total assets count
- Categories breakdown
- Generation date and disclaimer

#### B. Category-wise Breakdown with Visual Progress Bars
- Each category with count, value, and percentage
- Color-coded progress bars
- Visual representation of portfolio distribution

#### C. Detailed Asset Table
- Complete asset information
- Lower resolution images (max 300px width)
- All metadata fields:
  - Name/Model/Brand
  - Purchase date and cost
  - Invoice date
  - Current/Appraisal value
  - Serial numbers
  - Warranty information
  - Custom insurance notes

### 4. Image Handling
- Base64 encoded images
- Automatic resizing to lower resolution (300px max width)
- Fallback for missing images
- Maintains aspect ratio

### 5. Insurance-Specific Information
- **Disclaimer**: "This report contains information provided by the user. AuraInfra.ai does not verify the accuracy of asset values, descriptions, or documentation. This report is for insurance declaration purposes only."
- Purchase receipts section
- Appraisal certificates section
- Serial numbers for tracking
- Warranty details

### 6. Report Sections

```
1. Cover Page
   - Logo and branding
   - Report title: "Comprehensive Insurance Report"
   - Generation date
   - Total portfolio value

2. Executive Summary
   - Portfolio overview
   - Total value by category
   - Asset count summary
   - Pie chart representation

3. Category Breakdown
   - Visual progress bars
   - Percentage calculations
   - Category-specific insights

4. Detailed Asset Listings
   For each category:
   - Asset image (300px)
   - Complete specifications
   - Purchase information
   - Current valuation
   - Insurance notes (if provided)
   - Serial numbers and identifiers

5. Insurance Disclaimer
   - Data accuracy notice
   - User responsibility statement
   - Report purpose clarification

6. Footer
   - Generation timestamp
   - AuraInfra.ai branding
   - Confidentiality notice
```

## Technical Implementation

### Frontend Changes (`portfolio.tsx`)

1. **New State Variables**
```typescript
const [showAssetSelection, setShowAssetSelection] = useState(false);
const [selectedAssets, setSelectedAssets] = useState<{[key: string]: boolean}>({});
const [insuranceNotes, setInsuranceNotes] = useState('');
const [reportType, setReportType] = useState<'portfolio' | 'insurance'>('portfolio');
```

2. **Asset Selection Interface**
- Modal with category-grouped asset list
- Checkboxes for individual selection
- Select All functionality
- Continue button to proceed with report generation

3. **Image Processing**
```typescript
const resizeBase64Image = (base64: string, maxWidth: number): Promise<string> => {
  // Resize image to lower resolution
  // Convert to base64
  // Maintain aspect ratio
}
```

4. **Enhanced PDF HTML Template**
- Responsive CSS for all screen sizes
- Print-optimized styles
- Page break handling
- Professional insurance report layout

### Backend Requirements

No backend changes required. Using existing endpoints:
- `/api/portfolio/summary`
- `/api/portfolio/details`

### PDF Structure Example

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Professional insurance report styling */
    /* Print-optimized CSS */
    /* Image handling */
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <h1>Insurance Declaration Report</h1>
    <div class="total-value">$XXX,XXX</div>
  </div>

  <!-- Executive Summary -->
  <div class="executive-summary">
    <!-- Stats cards -->
  </div>

  <!-- Category Breakdown -->
  <div class="category-breakdown">
    <!-- Progress bars and percentages -->
  </div>

  <!-- Detailed Assets -->
  <div class="assets-detailed">
    <!-- Each asset with image -->
    <div class="asset-card">
      <img src="data:image/jpeg;base64,..." />
      <div class="asset-info">
        <!-- All details -->
      </div>
    </div>
  </div>

  <!-- Disclaimer -->
  <div class="disclaimer">
    <!-- Legal disclaimer -->
  </div>
</body>
</html>
```

## User Flow

1. User opens Portfolio screen
2. Clicks "Generate Insurance Report" button
3. Asset selection modal appears
4. User selects assets (or keeps all selected)
5. User optionally adds insurance notes
6. User clicks "Generate Report"
7. PDF is generated with all three formats
8. Share dialog appears
9. User can save or share PDF

## Benefits

1. **Comprehensive**: All asset information in one document
2. **Professional**: Insurance-ready format
3. **Flexible**: User can select specific assets
4. **Visual**: Images and charts included
5. **Compliant**: Includes necessary disclaimers
6. **Portable**: PDF format for easy sharing

## Testing Checklist

- [ ] Asset selection works correctly
- [ ] All assets selected by default
- [ ] Custom notes saved and included
- [ ] Images appear in PDF at correct size
- [ ] All three summary formats display
- [ ] Disclaimer text is clear
- [ ] PDF generates without errors
- [ ] Share functionality works on iOS and Android
- [ ] Large portfolios handled correctly
- [ ] Missing images handled gracefully
