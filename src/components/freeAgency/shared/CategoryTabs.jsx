import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG } from '../../../constants/holoTheme';

/**
 * CategoryTabs - Tab buttons for filtering by asset category
 *
 * Features:
 * - Three tabs: Neutral, Aggressive, Defensive
 * - Shows count of available free agents per category
 * - Highlights selected tab with category color
 * - Disabled state when swapping is blocked
 */
const CategoryTabs = ({
  selectedCategory,
  onSelectCategory,
  disabled = false,
  counts = { neutral: 0, aggressive: 0, defensive: 0 } // Number of free agents in each
}) => {
  const categories = ['neutral', 'aggressive', 'defensive'];

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
    }}>
      {categories.map((category) => {
        const config = CATEGORY_CONFIG[category];
        const isSelected = selectedCategory === category;
        const count = counts[category] || 0;

        return (
          <button
            key={category}
            onClick={() => !disabled && onSelectCategory(category)}
            disabled={disabled}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: isSelected
                ? `${config.color}22`
                : 'transparent',
              border: `1px solid ${isSelected ? config.color : HOLO_COLORS.borderSubtle}`,
              borderRadius: '8px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              color: isSelected ? config.color : HOLO_COLORS.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {config.label}
            </div>
            <div style={{
              fontSize: '10px',
              color: HOLO_COLORS.textMuted,
              marginTop: '2px',
            }}>
              {count} available
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default CategoryTabs;
