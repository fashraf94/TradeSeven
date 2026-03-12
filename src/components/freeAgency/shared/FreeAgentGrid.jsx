import React from 'react';
import { HOLO_COLORS } from '../../../constants/holoTheme';
import FreeAgentCard from './FreeAgentCard';
import CategoryTabs from './CategoryTabs';

/**
 * FreeAgentGrid - Grid of available free agents with category filtering
 *
 * BIDIRECTIONAL FLOW: User can select free agent first OR roster asset first.
 * When a roster asset is selected first, this section filters to matching category.
 *
 * Features:
 * - Category tabs (locked when a category is active from either selection)
 * - Scrollable list of free agents
 * - Selection state for chosen agent
 */
const FreeAgentGrid = ({
  freeAgents,
  selectedCategory,
  onSelectCategory,
  selectedAdd,         // The selected free agent
  selectedDrop,        // The selected roster asset (for drop-first flow)
  activeCategory,      // Category filter from either selection
  onSelectAdd,
  onMoreInfo,
  canSwap,
  livePrices = {},
}) => {
  // Get agents for current category (use activeCategory if set, otherwise selectedCategory)
  const effectiveCategory = activeCategory || selectedCategory;
  const displayedAgents = freeAgents[effectiveCategory] || [];

  // Lock category tabs when a selection has been made (from either direction)
  const categoryLocked = activeCategory !== null;

  // Count agents per category
  const counts = {
    neutral: freeAgents.neutral?.length || 0,
    aggressive: freeAgents.aggressive?.length || 0,
    defensive: freeAgents.defensive?.length || 0,
  };

  // Determine header text
  const getHeaderText = () => {
    if (activeCategory) {
      return `${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Free Agents`;
    }
    return 'Free Agents';
  };

  return (
    <div>
      {/* Section Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          color: HOLO_COLORS.textPrimary,
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          {getHeaderText()}
        </div>

        <div style={{
          fontSize: '10px',
          color: HOLO_COLORS.textMuted,
        }}>
          {displayedAgents.length} available
        </div>
      </div>

      {/* Helper Text - show when roster asset selected but no free agent yet */}
      {selectedDrop && !selectedAdd && canSwap && (
        <div style={{
          fontSize: '10px',
          color: HOLO_COLORS.cyan,
          textAlign: 'center',
          marginBottom: '10px',
          padding: '8px',
          background: `${HOLO_COLORS.cyan}11`,
          borderRadius: '6px',
          border: `1px solid ${HOLO_COLORS.cyan}33`,
        }}>
          Tap a {selectedDrop.category} free agent to add for {selectedDrop.symbol}
        </div>
      )}

      {/* Category Tabs - Locked when selection is active */}
      <div style={{ marginBottom: '12px' }}>
        <CategoryTabs
          selectedCategory={effectiveCategory}
          onSelectCategory={onSelectCategory}
          disabled={categoryLocked}
          counts={counts}
        />
      </div>

      {/* Agent Grid */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxHeight: '400px',
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingRight: '4px',
      }}>
        {displayedAgents.length === 0 ? (
          <div style={{
            padding: '24px',
            textAlign: 'center',
            color: HOLO_COLORS.textMuted,
            fontSize: '12px',
          }}>
            No free agents available in this category
          </div>
        ) : (
          displayedAgents.map((agent) => (
            <FreeAgentCard
              key={agent.symbol}
              asset={agent}
              isSelected={selectedAdd?.symbol === agent.symbol}
              onSelect={onSelectAdd}
              onMoreInfo={onMoreInfo}
              disabled={!canSwap}
              livePrices={livePrices}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FreeAgentGrid;
