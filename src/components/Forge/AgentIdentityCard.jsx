/**
 * AgentIdentityCard — container component composing the left pane identity:
 * Mech (children) → Class Title → LoadoutDropdown → DNASocketMatrix
 *
 * Replaces the old left pane layout (mech + radar chart + bundle strip + links).
 */

import React from 'react';
import { TRAIT_LIBRARY } from '../../data/traitLibrary';
import LoadoutDropdown from './LoadoutDropdown';
import DNASocketMatrix from './DNASocketMatrix';

const COMBO_GRADIENTS = {
  instincts: { start: '#5EEAD4', end: '#ffffff' },
  strategy:  { start: '#F59E0B', end: '#ffffff' },
  discipline: { start: '#EF4444', end: '#ffffff' },
  mixed:     { start: '#5EEAD4', end: '#F59E0B' },
};

export default function AgentIdentityCard({
  children,
  comboLabel,
  archetype,
  bundles,
  activeBundleId,
  onEquipBundle,
  onCreateBundle,
  maxBundles = 5,
  bundleCount = 0,
  slotUsage,
  equippedTraits,
  mechColors,
}) {
  // Resolve gradient colors for class title
  const gradientStart = mechColors?.gradientStart
    || COMBO_GRADIENTS[comboLabel?.gradientType]?.start
    || COMBO_GRADIENTS.mixed.start;
  const gradientEnd = mechColors?.gradientEnd
    || COMBO_GRADIENTS[comboLabel?.gradientType]?.end
    || COMBO_GRADIENTS.mixed.end;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0,
      width: '100%',
    }}>
      {/* Mech SVG — passed as children */}
      {children}

      {/* Class Title */}
      {comboLabel ? (
        <div style={{
          textAlign: 'center',
          marginTop: 4,
          fontSize: 16,
          fontWeight: 700,
          fontStyle: 'italic',
          background: `linear-gradient(90deg, ${gradientStart}, ${gradientEnd})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          The {comboLabel.label}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          marginTop: 4,
          fontSize: 14,
          color: '#718096',
          fontStyle: 'italic',
        }}>
          {archetype || 'No personality equipped'}
        </div>
      )}

      {/* Loadout Dropdown */}
      <div style={{ width: '100%', marginTop: 16, padding: '0 8px' }}>
        <LoadoutDropdown
          bundles={bundles}
          activeBundleId={activeBundleId}
          onEquipBundle={onEquipBundle}
          onCreateBundle={onCreateBundle}
          maxBundles={maxBundles}
          bundleCount={bundleCount}
        />
      </div>

      {/* DNA Socket Matrix */}
      <div style={{ width: '100%', marginTop: 12, padding: '0 8px' }}>
        <DNASocketMatrix
          slotUsage={slotUsage}
          equippedTraits={equippedTraits}
          traitLibrary={TRAIT_LIBRARY}
        />
      </div>
    </div>
  );
}
