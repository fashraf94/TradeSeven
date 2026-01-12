import React from 'react';
import { HOLO_COLORS } from '../../../constants/holoTheme';
import FreeAgentCard from './FreeAgentCard';
import CategoryTabs from './CategoryTabs';

/**
 * FreeAgentGrid - Grid of available free agents with category filtering
 *
 * Features:
 * - Category tabs (lock when drop selected)
 * - Scrollable list of free agents
 * - Shows "+ Add" when asset is selectable
 */
const FreeAgentGrid = ({
  freeAgents,
  selectedCategory,
  onSelectCategory,
  selectedDrop,
  onSelectAdd,
  onMoreInfo,          // Callback for researching agents
  canSwap,
}) => {
  // Get agents for current category
  const displayedAgents = freeAgents[selectedCategory] || [];

  // Category is locked when a drop is selected
  const categoryLocked = selectedDrop !== null;

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
          color: HOLO_COLORS.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          Free Agents
        </div>

        <div style={{
          fontSize: '10px',
          color: HOLO_COLORS.textMuted,
        }}>
          {displayedAgents.length} available
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ marginBottom: '12px' }}>
        <CategoryTabs
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          disabled={categoryLocked}
          counts={counts}
        />

        {categoryLocked && (
          <div style={{
            fontSize: '9px',
            color: HOLO_COLORS.amber,
            textAlign: 'center',
            marginTop: '6px',
          }}>
            Category locked to match selected asset
          </div>
        )}
      </div>

      {/* Agent Grid */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxHeight: '400px',
        overflowY: 'auto',
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
              onSelect={onSelectAdd}
              onMoreInfo={onMoreInfo}
              disabled={!canSwap}
              isSelectable={selectedDrop !== null && selectedDrop.category === agent.category}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FreeAgentGrid;
