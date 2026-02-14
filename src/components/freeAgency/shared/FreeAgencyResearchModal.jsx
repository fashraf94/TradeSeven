// FreeAgencyResearchModal — Shared research modal wrapper for Free Agency screens.
// Normalises asset data using buildResearchAsset and wires up the "Select" action button.
// Used by both FreeAgencyMobile and FreeAgencyDesktop.

import React from 'react';
import { AssetResearchModal } from '../../draft';
import { buildResearchAsset } from '../../../utils/researchAssetBuilder';

export default function FreeAgencyResearchModal({
  asset,
  currentDraft,
  livePrices = {},
  canSwap = false,
  selectedAdd = null,
  onSelectAdd,
  onClose,
}) {
  if (!asset) return null;

  const researchAsset = buildResearchAsset(asset, {
    livePrices,
    thresholds: currentDraft?.thresholds,
    openPrices: currentDraft?.lockedPrices,
  });

  return (
    <AssetResearchModal
      asset={researchAsset}
      sector={asset.sector}
      category={asset.category}
      onClose={onClose}
      showActionButton={true}
      actionConfig={
        canSwap && !selectedAdd?.symbol
          ? {
              label: `Select ${asset.symbol}`,
              onClick: () => {
                onSelectAdd?.(asset);
                onClose();
              },
              variant: 'primary',
              disabled: false,
            }
          : null
      }
      version={2}
    />
  );
}
