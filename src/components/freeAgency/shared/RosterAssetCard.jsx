import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG } from '../../../constants/holoTheme';
import { CategoryBadge, GainLossBadge, HoloCard } from '../../shared';

/**
 * RosterAssetCard - Individual asset card in the "Select to Drop" section
 *
 * Displays user's portfolio asset with:
 * - Category color indicator
 * - Symbol and gain/loss percentage (using GainLossBadge)
 * - Selected state with red highlight and "DROP" badge (using HoloCard)
 * - Info button for opening research modal
 */
const RosterAssetCard = ({
  asset,
  isSelected,
  onSelect,
  onMoreInfo,        // Callback for info button
  disabled = false,
  compact = false,
  isLocked = false,  // Orange Zone swap lock
}) => {
  const categoryConfig = CATEGORY_CONFIG[asset.category] || CATEGORY_CONFIG.neutral;
  const gain = asset.gain || 0;
  const effectiveDisabled = disabled || isLocked;

  return (
    <HoloCard
      as="button"
      variant="interactive"
      accentColor="red"
      size={compact ? 'sm' : 'md'}
      selected={isSelected}
      disabled={effectiveDisabled}
      onClick={() => onSelect(asset)}
      style={{
        position: 'relative',
        width: compact ? '100px' : '110px',
        minWidth: compact ? '100px' : '110px',
        paddingTop: isSelected ? '18px' : undefined,
        marginTop: isSelected ? '12px' : '0',
        textAlign: 'left',
        opacity: isLocked ? 0.5 : undefined,
        // Add inset shadow for selected state (unique to this card)
        boxShadow: isSelected
          ? `0 0 15px ${HOLO_COLORS.red}44, inset 0 0 20px ${HOLO_COLORS.red}11`
          : isLocked
            ? `0 0 8px rgba(245, 158, 11, 0.3)`
            : undefined,
      }}
    >
      {/* Selected indicator - "DROP" badge */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: HOLO_COLORS.red,
          color: '#000',
          fontSize: '9px',
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          zIndex: 1,
          boxShadow: `0 2px 8px ${HOLO_COLORS.red}66`,
        }}>
          Drop
        </div>
      )}

      {/* Info Button - Top Right */}
      {onMoreInfo && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onMoreInfo(asset);
          }}
          style={{
            position: 'absolute',
            top: isSelected ? '14px' : '6px',
            right: '6px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: `${HOLO_COLORS.cyan}22`,
            border: `1px solid ${HOLO_COLORS.cyan}55`,
            color: HOLO_COLORS.cyan,
            fontSize: '10px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            zIndex: 2,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${HOLO_COLORS.cyan}44`;
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `${HOLO_COLORS.cyan}22`;
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          i
        </div>
      )}

      {/* Category indicator line */}
      <div style={{
        position: 'absolute',
        top: '8px',
        left: '8px',
        bottom: '8px',
        width: '3px',
        borderRadius: '2px',
        background: categoryConfig.color,
        boxShadow: `0 0 6px ${categoryConfig.color}66`,
      }} />

      {/* Content */}
      <div style={{ marginLeft: '10px', marginRight: onMoreInfo ? '18px' : '0' }}>
        {/* Symbol */}
        <div style={{
          fontSize: compact ? '13px' : '14px',
          fontWeight: 700,
          color: isLocked ? '#f59e0b' : HOLO_COLORS.textPrimary,
          marginBottom: '4px',
        }}>
          {isLocked ? '\uD83D\uDD12 ' : ''}{asset.symbol}
        </div>

        {/* Gain */}
        <GainLossBadge
          value={gain}
          variant="text"
          size={compact ? 'sm' : 'md'}
        />

        {/* Category badge */}
        <CategoryBadge
          category={asset.category}
          variant="letter"
          size="sm"
          style={{ marginTop: '4px' }}
        />
      </div>
    </HoloCard>
  );
};

export default RosterAssetCard;
