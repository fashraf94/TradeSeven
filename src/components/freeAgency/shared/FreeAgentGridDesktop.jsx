import React from 'react';
import { HOLO_COLORS } from '../../../constants/holoTheme';
import FreeAgentCard from './FreeAgentCard';
import CategoryTabs from './CategoryTabs';

/**
 * FreeAgentGridDesktop - Larger 2-column grid for desktop
 *
 * NEW FLOW: Step 1 - User selects a free agent FIRST, then picks which roster asset to drop.
 *
 * Features:
 * - 2-column grid layout
 * - Selection state for chosen agent
 * - Category tabs always enabled
 */
const FreeAgentGridDesktop = ({
  freeAgents,
  selectedCategory,
  onSelectCategory,
  selectedAdd,       // The selected free agent
  onSelectAdd,
  onMoreInfo,
  canSwap,
  livePrices = {},
}) => {
  const displayedAgents = freeAgents[selectedCategory] || [];

  // Category tabs are NOT locked in new flow
  const categoryLocked = false;

  const counts = {
    neutral: freeAgents.neutral?.length || 0,
    aggressive: freeAgents.aggressive?.length || 0,
    defensive: freeAgents.defensive?.length || 0,
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 700,
          color: HOLO_COLORS.textPrimary,
        }}>
          {selectedAdd ? 'Free Agent Marketplace' : 'Step 1: Select Free Agent'}
        </div>
        <div style={{
          fontSize: '12px',
          color: HOLO_COLORS.textMuted,
        }}>
          {displayedAgents.length} available
        </div>
      </div>

      {/* Helper Text - only show when nothing selected */}
      {!selectedAdd && canSwap && (
        <div style={{
          padding: '12px',
          background: `${HOLO_COLORS.cyan}11`,
          border: `1px solid ${HOLO_COLORS.cyan}33`,
          borderRadius: '8px',
          marginBottom: '16px',
          textAlign: 'center',
          fontSize: '12px',
          color: HOLO_COLORS.cyan,
        }}>
          Click a free agent to begin swap
        </div>
      )}

      {/* Category Tabs - Always enabled */}
      <div style={{ marginBottom: '16px' }}>
        <CategoryTabs
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          disabled={categoryLocked}
          counts={counts}
        />
      </div>

      {/* Agent Grid - 2 columns for desktop */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        alignContent: 'start',
        paddingRight: '8px',
      }}>
        {displayedAgents.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            padding: '40px',
            textAlign: 'center',
            color: HOLO_COLORS.textMuted,
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

export default FreeAgentGridDesktop;
