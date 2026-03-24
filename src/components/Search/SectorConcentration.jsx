import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { SECTORS } from '../../constants/sectors';

// Map sectorId → { name, color }
const getSectorInfo = (sectorId) => {
  const s = SECTORS[sectorId];
  return s ? { name: s.name, color: s.color } : { name: sectorId || 'Unknown', color: '#6b7280' };
};

const SectorConcentration = ({ stocks, type, count = 20 }) => {
  const { tokens } = useTheme();

  const { sectors, dominant, total } = useMemo(() => {
    if (!stocks?.length) return { sectors: [], dominant: null, total: 0 };

    const topN = stocks.slice(0, count);
    const sectorCounts = {};

    topN.forEach(stock => {
      const info = getSectorInfo(stock.sectorId);
      if (!sectorCounts[info.name]) {
        sectorCounts[info.name] = { name: info.name, color: info.color, count: 0 };
      }
      sectorCounts[info.name].count++;
    });

    const sorted = Object.values(sectorCounts).sort((a, b) => b.count - a.count);
    return {
      sectors: sorted,
      dominant: sorted[0] || null,
      total: topN.length,
    };
  }, [stocks, count]);

  if (!dominant || sectors.length === 0) return null;

  const typeLabel = type === 'composite' ? 'composite' : type === 'fundamental' ? 'fundamental' : 'technical';

  return (
    <div style={{
      borderRadius: '14px',
      background: tokens.bgCard,
      boxShadow: tokens.obsidianShadow,
      padding: '14px',
      marginBottom: '16px',
      border: `0.5px solid ${tokens.borderDefault}`,
      backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'rgba(94,234,212,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Sparkles size={14} color={tokens.teal} />
        </div>
        <span style={{ fontSize: '12px', fontWeight: 600, color: tokens.textPrimary }}>
          Sector Concentration
        </span>
      </div>

      {/* Horizontal stacked bar */}
      <div style={{
        display: 'flex',
        height: '8px',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '8px',
      }}>
        {sectors.map((sector, i) => (
          <div
            key={sector.name}
            style={{
              flex: sector.count,
              background: sector.color,
              opacity: 0.8,
              borderRight: i < sectors.length - 1 ? '1px solid rgba(0,0,0,0.3)' : undefined,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 12px',
        marginBottom: '10px',
      }}>
        {sectors.slice(0, 6).map(sector => (
          <div key={sector.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: sector.color,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: '10px', color: tokens.textMuted }}>
              {sector.name} ({sector.count})
            </span>
          </div>
        ))}
      </div>

      {/* Insight text */}
      <div style={{ fontSize: '12px', color: '#c2c0b6', lineHeight: 1.5 }}>
        <span style={{ color: dominant.color, fontWeight: 600 }}>{dominant.name}</span>
        {' '}dominates — {dominant.count} of top {total} {typeLabel} stocks.
      </div>
    </div>
  );
};

export default SectorConcentration;
