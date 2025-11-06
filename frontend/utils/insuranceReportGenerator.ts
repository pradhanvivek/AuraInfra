import { formatCurrency } from './localeUtils';

export interface AssetItem {
  id: string;
  name?: string;
  model?: string;
  brand?: string;
  address?: string;
  category?: string;
  artist?: string;
  material?: string;
  purchase_date?: string;
  purchase_cost?: number;
  current_value?: number;
  appraisal_value?: number;
  warranty_expiry?: string;
  serial_number?: string;
  photos?: string[];
  notes?: string;
  invoice_number?: string;
  invoice_date?: string;
  supplier?: string;
  receipt_photo?: string;
}

export interface PortfolioData {
  total_value: number;
  properties_value: number;
  vehicles_value: number;
  appliances_value: number;
  jewelry_value: number;
  furniture_value: number;
  art_value: number;
  properties_count: number;
  vehicles_count: number;
  appliances_count: number;
  jewelry_count: number;
  furniture_count: number;
  art_count: number;
}

export interface DetailedData {
  properties: AssetItem[];
  vehicles: AssetItem[];
  appliances: AssetItem[];
  jewelry: AssetItem[];
  furniture: AssetItem[];
  art: AssetItem[];
}

export interface Category {
  name: string;
  count: number;
  value: number;
  percentage: number;
  color: string;
}

export const generateInsuranceReportHTML = (
  portfolio: PortfolioData,
  detailedData: DetailedData,
  categories: Category[],
  insuranceNotes: string,
  selectedAssets?: Set<string>
): string => {
  const totalAssets = portfolio.properties_count + portfolio.vehicles_count + 
                     portfolio.appliances_count + portfolio.jewelry_count +
                     portfolio.furniture_count + portfolio.art_count;

  // Filter assets if selection is provided
  const filterAssets = (items: AssetItem[]) => {
    if (!selectedAssets || selectedAssets.size === 0) return items;
    return items.filter(item => selectedAssets.has(item.id));
  };

  const filteredData = {
    properties: filterAssets(detailedData.properties),
    vehicles: filterAssets(detailedData.vehicles),
    appliances: filterAssets(detailedData.appliances),
    jewelry: filterAssets(detailedData.jewelry),
    furniture: filterAssets(detailedData.furniture),
    art: filterAssets(detailedData.art),
  };

  const selectedCount = Object.values(filteredData).reduce((sum, arr) => sum + arr.length, 0);

  // Helper to render asset items with images
  const renderAssetSection = (title: string, items: AssetItem[], valueField: string = 'current_value') => {
    if (items.length === 0) return '';
    
    return `
      <div class="asset-section">
        <h2 class="asset-section-title">${title}</h2>
        ${items.map((item, index) => {
          const value = item[valueField as keyof AssetItem] || item.purchase_cost || item.appraisal_value || 0;
          const imageData = item.photos && item.photos.length > 0 ? item.photos[0] : null;
          
          return `
            <div class="asset-item">
              ${imageData ? `
                <div class="asset-image-container">
                  <img src="${imageData}" class="asset-image" alt="${item.name || 'Asset'}" />
                </div>
              ` : ''}
              <div class="asset-content">
                <div class="asset-header">
                  <span class="asset-number">#${index + 1}</span>
                  <h3 class="asset-name">${item.name || item.model || item.brand || 'Unnamed Item'}</h3>
                </div>
                <div class="asset-details-grid">
                  ${item.brand ? `<div class="detail-item"><strong>Brand:</strong> ${item.brand}</div>` : ''}
                  ${item.model ? `<div class="detail-item"><strong>Model:</strong> ${item.model}</div>` : ''}
                  ${item.address ? `<div class="detail-item"><strong>Address:</strong> ${item.address}</div>` : ''}
                  ${item.category ? `<div class="detail-item"><strong>Category:</strong> ${item.category}</div>` : ''}
                  ${item.artist ? `<div class="detail-item"><strong>Artist:</strong> ${item.artist}</div>` : ''}
                  ${item.material ? `<div class="detail-item"><strong>Material:</strong> ${item.material}</div>` : ''}
                  ${item.serial_number ? `<div class="detail-item"><strong>Serial #:</strong> ${item.serial_number}</div>` : ''}
                  ${item.purchase_date ? `
                    <div class="detail-item">
                      <strong>Purchase Date:</strong> ${new Date(item.purchase_date).toLocaleDateString()}
                    </div>
                  ` : ''}
                  ${item.purchase_cost ? `
                    <div class="detail-item">
                      <strong>Purchase Cost:</strong> ${formatCurrency(item.purchase_cost)}
                    </div>
                  ` : ''}
                  ${item.warranty_expiry ? `
                    <div class="detail-item">
                      <strong>Warranty Until:</strong> ${new Date(item.warranty_expiry).toLocaleDateString()}
                    </div>
                  ` : ''}
                </div>
                <div class="asset-value-box">
                  <span class="value-label">Current Value:</span>
                  <span class="value-amount">${formatCurrency(Number(value))}</span>
                </div>
                ${item.notes ? `
                  <div class="asset-notes">
                    <strong>Notes:</strong> ${item.notes}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  // Create comprehensive insurance report HTML
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          padding: 40px;
          color: #333;
          line-height: 1.6;
          background: white;
        }
        
        /* Cover Page */
        .cover-page {
          text-align: center;
          padding: 80px 20px;
          page-break-after: always;
        }
        .logo {
          width: 120px;
          height: 120px;
          background: linear-gradient(135deg, #5856D6 0%, #7B79E8 100%);
          border-radius: 30px;
          margin: 0 auto 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 60px;
          font-weight: bold;
          box-shadow: 0 6px 25px rgba(88, 86, 214, 0.4);
        }
        h1 {
          color: #5856D6;
          margin: 20px 0;
          font-size: 42px;
        }
        .subtitle {
          color: #666;
          font-size: 18px;
          margin: 15px 0 40px;
        }
        .report-meta {
          background: #f8f8f8;
          padding: 30px;
          border-radius: 15px;
          margin-top: 40px;
          text-align: left;
        }
        .report-meta-item {
          padding: 12px 0;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
        }
        .report-meta-item:last-child {
          border-bottom: none;
        }
        
        /* Executive Summary */
        .executive-summary {
          margin: 40px 0;
          page-break-inside: avoid;
        }
        .summary-card {
          background: linear-gradient(135deg, #5856D6 0%, #7B79E8 100%);
          color: white;
          padding: 40px;
          border-radius: 20px;
          text-align: center;
          box-shadow: 0 6px 20px rgba(88, 86, 214, 0.3);
          margin-bottom: 30px;
        }
        .summary-label {
          font-size: 18px;
          opacity: 0.95;
          margin-bottom: 15px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }
        .summary-value {
          font-size: 56px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .summary-subtext {
          font-size: 18px;
          opacity: 0.9;
        }
        
        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin: 30px 0;
        }
        .stat-card {
          background: #f8f8f8;
          border-radius: 15px;
          padding: 30px;
          text-align: center;
        }
        .stat-value {
          font-size: 42px;
          font-weight: bold;
          margin: 15px 0;
          color: #5856D6;
        }
        .stat-label {
          font-size: 14px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        /* Section Titles */
        .section-title {
          font-size: 28px;
          font-weight: bold;
          margin: 50px 0 25px;
          color: #000;
          padding-bottom: 15px;
          border-bottom: 3px solid #5856D6;
          page-break-after: avoid;
        }
        
        /* Category Breakdown */
        .category-item {
          background: #f8f8f8;
          border-radius: 15px;
          padding: 25px;
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .category-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .category-name {
          font-size: 20px;
          font-weight: 600;
        }
        .category-count {
          font-size: 14px;
          color: #666;
        }
        .category-value {
          font-size: 28px;
          font-weight: bold;
          margin: 10px 0;
        }
        .category-percentage {
          font-size: 14px;
          color: #666;
          margin-bottom: 15px;
        }
        .progress-bar {
          height: 10px;
          background: #e0e0e0;
          border-radius: 5px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          border-radius: 5px;
          transition: width 0.3s ease;
        }
        
        /* Asset Sections */
        .asset-section {
          margin: 40px 0;
          page-break-inside: avoid;
        }
        .asset-section-title {
          font-size: 24px;
          font-weight: bold;
          color: #5856D6;
          margin: 30px 0 20px;
          padding: 15px 25px;
          background: #F3F2FF;
          border-left: 6px solid #5856D6;
          border-radius: 8px;
        }
        .asset-item {
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 15px;
          padding: 25px;
          margin-bottom: 25px;
          page-break-inside: avoid;
        }
        .asset-image-container {
          width: 100%;
          max-width: 300px;
          margin: 0 auto 20px;
          border-radius: 12px;
          overflow: hidden;
          background: #f8f8f8;
        }
        .asset-image {
          width: 100%;
          height: auto;
          display: block;
        }
        .asset-content {
          width: 100%;
        }
        .asset-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #f0f0f0;
        }
        .asset-number {
          background: #5856D6;
          color: white;
          width: 45px;
          height: 45px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 18px;
          flex-shrink: 0;
        }
        .asset-name {
          font-size: 22px;
          font-weight: 700;
          color: #000;
          flex: 1;
        }
        .asset-details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin: 20px 0;
        }
        .detail-item {
          font-size: 14px;
          color: #666;
        }
        .detail-item strong {
          color: #333;
          display: block;
          margin-bottom: 4px;
        }
        .asset-value-box {
          background: #F3F2FF;
          padding: 20px;
          border-radius: 12px;
          margin: 20px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .value-label {
          font-size: 16px;
          color: #666;
          font-weight: 600;
        }
        .value-amount {
          font-size: 28px;
          font-weight: bold;
          color: #5856D6;
        }
        .asset-notes {
          background: #fffef0;
          border-left: 4px solid #FFB900;
          padding: 15px;
          border-radius: 8px;
          font-size: 14px;
          margin-top: 15px;
        }
        
        /* Disclaimer */
        .disclaimer {
          background: #FFF3CD;
          border: 2px solid #FFC107;
          border-radius: 15px;
          padding: 30px;
          margin: 50px 0;
          page-break-inside: avoid;
        }
        .disclaimer-title {
          font-size: 20px;
          font-weight: bold;
          color: #856404;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .disclaimer-text {
          font-size: 14px;
          color: #856404;
          line-height: 1.8;
        }
        
        /* Footer */
        .footer {
          margin-top: 60px;
          padding-top: 30px;
          border-top: 2px solid #e0e0e0;
          text-align: center;
          color: #666;
          font-size: 13px;
          page-break-inside: avoid;
        }
        .footer p {
          margin: 8px 0;
        }
        
        /* Page Breaks */
        .page-break {
          page-break-after: always;
        }
        
        /* Print Optimization */
        @media print {
          body { padding: 20px; }
          .page-break { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <!-- Cover Page -->
      <div class="cover-page">
        <div class="logo">A</div>
        <h1>Comprehensive Insurance Report</h1>
        <div class="subtitle">Personal Asset Portfolio & Declaration</div>
        
        <div class="summary-card">
          <div class="summary-label">Total Declared Value</div>
          <div class="summary-value">${formatCurrency(portfolio.total_value)}</div>
          <div class="summary-subtext">${selectedCount} items declared for insurance</div>
        </div>
        
        <div class="report-meta">
          <div class="report-meta-item">
            <span><strong>Report Date:</strong></span>
            <span>${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric'
            })}</span>
          </div>
          <div class="report-meta-item">
            <span><strong>Total Items:</strong></span>
            <span>${selectedCount}</span>
          </div>
          <div class="report-meta-item">
            <span><strong>Categories:</strong></span>
            <span>${categories.filter(c => c.count > 0).length}</span>
          </div>
          <div class="report-meta-item">
            <span><strong>Generated By:</strong></span>
            <span>AuraInfra.ai</span>
          </div>
        </div>
        
        ${insuranceNotes ? `
          <div class="asset-notes" style="margin-top: 30px; text-align: left;">
            <strong>Insurance Notes:</strong><br/>
            ${insuranceNotes}
          </div>
        ` : ''}
      </div>

      <!-- Executive Summary -->
      <div class="executive-summary">
        <h2 class="section-title">Executive Summary</h2>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Value</div>
            <div class="stat-value">${formatCurrency(portfolio.total_value)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Items</div>
            <div class="stat-value">${selectedCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Categories</div>
            <div class="stat-value">${categories.filter(c => c.count > 0).length}</div>
          </div>
        </div>
      </div>

      <!-- Category Breakdown with Visual Progress Bars -->
      <div class="section-title">Portfolio Breakdown by Category</div>
      
      ${categories.map(cat => cat.count > 0 ? `
        <div class="category-item">
          <div class="category-header">
            <div>
              <div class="category-name">${cat.name}</div>
              <div class="category-count">${cat.count} ${cat.count === 1 ? 'item' : 'items'}</div>
            </div>
          </div>
          <div class="category-value" style="color: ${cat.color};">${formatCurrency(cat.value)}</div>
          <div class="category-percentage">${cat.percentage.toFixed(1)}% of total portfolio</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${cat.percentage}%; background: ${cat.color};"></div>
          </div>
        </div>
      ` : '').join('')}

      <div class="page-break"></div>

      <!-- Detailed Asset Listings with Images -->
      <h2 class="section-title">Detailed Asset Inventory</h2>
      
      ${renderAssetSection('Properties', filteredData.properties)}
      ${renderAssetSection('Vehicles', filteredData.vehicles)}
      ${renderAssetSection('Appliances', filteredData.appliances)}
      ${renderAssetSection('Jewelry', filteredData.jewelry, 'appraisal_value')}
      ${renderAssetSection('Furniture', filteredData.furniture)}
      ${renderAssetSection('Art', filteredData.art, 'appraisal_value')}

      <!-- Insurance Disclaimer -->
      <div class="disclaimer">
        <div class="disclaimer-title">
          ⚠️ Insurance Declaration Disclaimer
        </div>
        <div class="disclaimer-text">
          <p><strong>Important Notice:</strong></p>
          <p>This report contains information provided by the user through the AuraInfra.ai platform. 
          AuraInfra.ai does not independently verify the accuracy of asset values, descriptions, purchase dates, 
          or any other information contained in this report.</p>
          <br/>
          <p><strong>User Responsibility:</strong></p>
          <p>The user is solely responsible for the accuracy and completeness of all information declared herein. 
          This report is intended for insurance declaration purposes only and should be used in conjunction with 
          official documentation such as purchase receipts, appraisal certificates, and warranties.</p>
          <br/>
          <p><strong>Verification Recommended:</strong></p>
          <p>Insurance providers may require additional documentation and independent appraisals to validate 
          the declared values. Users should consult with their insurance provider regarding specific documentation 
          requirements.</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p><strong>Generated on ${new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</strong></p>
        <p style="margin-top: 15px; font-size: 16px;"><strong>AuraInfra.ai</strong></p>
        <p>Your Digital Vault for Physical Assets</p>
        <p style="margin-top: 15px; font-size: 12px; color: #999;">
          This report contains confidential information. Keep secure and do not share with unauthorized parties.
        </p>
        <p style="margin-top: 5px; font-size: 11px; color: #999;">
          For questions or support, visit https://aurainfra.ai
        </p>
      </div>
    </body>
    </html>
  `;
};
