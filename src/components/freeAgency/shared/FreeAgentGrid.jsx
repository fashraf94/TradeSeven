import React from 'react';
import { HOLO_COLORS } from '../../../constants/holoTheme';
import FreeAgentCard from './FreeAgentCard';
import CategoryTabs from './CategoryTabs';

/**
 * FreeAgentGrid - Grid of available free agents with category filtering
 *
 * NEW FLOW: This is now Step 1. User selects a free agent FIRST,
 * then goes to roster to select which asset to drop.
 *
 * Features:
 * - Category tabs (always enabled - user can browse freely)
 * - Scrollable list of free agents
 * - Selection state for chosen agent
 */
const FreeAgentGrid = ({
  freeAgents,
  selectedCategory,
  onSelectCategory,
  selectedAdd,         // The selected free agent
  onSelectAdd,
  onMoreInfo,
  canSwap,
}) => {
  // Get agents for current category
  const displayedAgents = freeAgents[selectedCategory] || [];

  // Category tabs are NOT locked in new flow - user can browse freely
  const categoryLocked = false;

  // Count agents per category
  const counts = {
    steady: freeAgents.steady?.length || 0,
    risky: freeAgents.risky?.length || 0,
    defensive: freeAgents.defensive?.length || 0,
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
          {selectedAdd ? 'Free Agents' : 'Step 1: Select Free Agent'}
        </div>

        <div style={{
          fontSize: '10px',
          color: HOLO_COLORS.textMuted,
        }}>
          {displayedAgents.length} available
        </div>
      </div>

      {/* Helper Text - only show when nothing selected */}
      {!selectedAdd && canSwap && (
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
          Tap a free agent to begin swap
        </div>
      )}

      {/* Category Tabs - Always enabled */}
      <div style={{ marginBottom: '12px' }}>
        <CategoryTabs
          selectedCategory={selectedCategory}
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
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FreeAgentGrid;
