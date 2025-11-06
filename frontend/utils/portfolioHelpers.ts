// Helper functions for portfolio screen

export const initializeSelectedAssets = (detailedData: any): Set<string> => {
  const allAssets = new Set<string>();
  
  // Add all asset IDs from all categories
  ['properties', 'vehicles', 'appliances', 'jewelry', 'furniture', 'art'].forEach(category => {
    if (detailedData[category]) {
      detailedData[category].forEach((asset: any) => {
        if (asset.id) {
          allAssets.add(asset.id);
        }
      });
    }
  });
  
  return allAssets;
};

export const handleToggleAsset = (
  assetId: string,
  selectedAssets: Set<string>,
  setSelectedAssets: (assets: Set<string>) => void
) => {
  const newSelection = new Set(selectedAssets);
  if (newSelection.has(assetId)) {
    newSelection.delete(assetId);
  } else {
    newSelection.add(assetId);
  }
  setSelectedAssets(newSelection);
};

export const handleSelectAll = (
  detailedData: any,
  setSelectedAssets: (assets: Set<string>) => void
) => {
  const allAssets = initializeSelectedAssets(detailedData);
  setSelectedAssets(allAssets);
};

export const handleDeselectAll = (
  setSelectedAssets: (assets: Set<string>) => void
) => {
  setSelectedAssets(new Set());
};
