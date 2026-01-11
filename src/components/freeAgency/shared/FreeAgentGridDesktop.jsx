import React from 'react';
import { HOLO_COLORS } from '../../../constants/holoTheme';
import FreeAgentCard from './FreeAgentCard';
import CategoryTabs from './CategoryTabs';

/**
 * FreeAgentGridDesktop - Larger 2-column grid for desktop
 *
 * Features:
 * - 2-column grid layout
 * - More spacious cards
 * - Scrollable within container
 */
const FreeAgentGridDesktop = ({
  freeAgents,
  selectedCategory,
  onSelectCategory,
  selectedDrop,
  onSelectAdd,
  canSwap,
}) => {
  const displayedAgents = freeAgents[selectedCategory] || [];
  const categoryLocked = selectedDrop !== null;

  const counts = {
    steady: freeAgents.steady?.length || 0,
    risky: freeAgents.risky?.length || 0,
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
          Free Agent Marketplace
        </div>
        <div style={{
          fontSize: '12px',
          color: HOLO_COLORS.textMuted,
        }}>
          {displayedAgents.length} available
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ marginBottom: '16px' }}>
        <CategoryTabs
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          disabled={categoryLocked}
          counts={counts}
        />
        {categoryLocked && (
          <div style={{
            fontSize: '10px',
            color: HOLO_COLORS.amber,
            textAlign: 'center',
            marginTop: '8px',
          }}>
            Category locked to {selectedDrop.category}
          </div>
        )}
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
              onSelect={onSelectAdd}
              disabled={!canSwap}
              isSelectable={selectedDrop !== null && selectedDrop.category === agent.category}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FreeAgentGridDesktop;
