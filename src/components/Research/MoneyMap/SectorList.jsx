// /src/components/Research/MoneyMap/SectorList.jsx

import React, { useMemo } from 'react';
import SectorCard from './SectorCard';
import { QUADRANT_LABELS } from '../../../services/moneyMapEngine';

// ===========================================
// GROUP HEADER CONFIG
// UI-specific labels for quadrant groups (different from engine labels)
// ===========================================
const QUADRANT_ORDER = ['LEADING', 'WEAKENING', 'IMPROVING', 'LAGGING', 'NEUTRAL'];

const GROUP_HEADERS = {
  LEADING:   { label: 'MARKET LEADERS',  color: QUADRANT_LABELS.LEADING.color },
  WEAKENING: { label: 'COOLING OFF',     color: QUADRANT_LABELS.WEAKENING.color },
  IMPROVING: { label: 'COMEBACK KIDS',   color: QUADRANT_LABELS.IMPROVING.color },
  LAGGING:   { label: 'UNDERDOGS',       color: QUADRANT_LABELS.LAGGING.color },
  NEUTRAL:   { label: 'AT MARKET PACE',  color: QUADRANT_LABELS.NEUTRAL.color },
};

/**
 * SectorList — Groups SectorCards by momentum quadrant
 *
 * @param {Object}      props
 * @param {Object}      props.sectors           - Object keyed by sectorId
 * @param {string|null} props.expandedSectorId  - Currently expanded sector, or null
 * @param {function}    props.onToggleSector     - (sectorId) => void
 */
const SectorList = ({ sectors, expandedSectorId, onToggleSector, onTooltip }) => {
  // Group sectors by quadrant, sort within each group by momentumScore desc
  const groups = useMemo(() => {
    const sectorArray = Object.values(sectors || {});

    return QUADRANT_ORDER
      .map(quadrantId => {
        const groupSectors = sectorArray
          .filter(s => s.quadrant?.quadrant === quadrantId)
          .sort((a, b) => (b.momentumScore || 0) - (a.momentumScore || 0));

        return {
          quadrantId,
          header: GROUP_HEADERS[quadrantId],
          sectors: groupSectors,
        };
      })
      .filter(g => g.sectors.length > 0);
  }, [sectors]);

  if (groups.length === 0) {
    return (
      <div style={{
        background: '#161b22',
        border: '1px solid #21262d',
        borderRadius: '16px',
        padding: '20px',
        textAlign: 'center',
      }}>
        <span style={{ color: '#8b949e', fontSize: '14px' }}>
          No sector data available
        </span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    }}>
      {groups.map(group => (
        <div key={group.quadrantId}>
          {/* Group Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
          }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: group.header.color,
              flexShrink: 0,
            }} />
            <span style={{
              color: group.header.color,
              fontSize: '13px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {group.header.label}
            </span>
            <span style={{
              color: '#8b949e',
              fontSize: '12px',
            }}>
              ({group.sectors.length})
            </span>
          </div>

          {/* Cards within group */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {group.sectors.map(sector => (
              <SectorCard
                key={sector.sectorId}
                sector={sector}
                isExpanded={expandedSectorId === sector.sectorId}
                onToggle={() => onToggleSector(sector.sectorId)}
                onTooltip={onTooltip}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SectorList;
