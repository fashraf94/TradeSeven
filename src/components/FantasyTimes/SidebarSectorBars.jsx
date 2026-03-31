// src/components/FantasyTimes/SidebarSectorBars.jsx
// Compact sector performance horizontal bars for Kim's desktop sidebar.

import React from 'react';
import { REPORTER_COLORS, BROADSHEET_TOKENS } from '../../constants/reporterTheme';

export default function SidebarSectorBars({ sectorData }) {
  if (!sectorData?.length) return null;

  const sorted = [...sectorData].sort((a, b) => b.changePercent - a.changePercent);
  const maxChange = Math.max(...sorted.map(s => Math.abs(s.changePercent)), 0.1);

  return (
    <div style={{ marginTop: 20, borderTop: `1px solid ${BROADSHEET_TOKENS.sectionRule}`, paddingTop: 16 }}>
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontMono,
        fontSize: 10,
        letterSpacing: '0.2em',
        color: REPORTER_COLORS.kim.hex,
        textTransform: 'uppercase',
        marginBottom: 12,
      }}>
        SECTOR PERFORMANCE
      </div>
      {sorted.map((sector) => {
        const isPositive = sector.changePercent >= 0;
        const barWidth = (Math.abs(sector.changePercent) / maxChange) * 100;
        const barColor = isPositive ? '#10b981' : '#ef4444';

        return (
          <div key={sector.etf} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 5,
            fontSize: 11,
          }}>
            <span style={{
              fontFamily: BROADSHEET_TOKENS.fontMono,
              color: '#8b949e',
              width: 36,
              flexShrink: 0,
              fontSize: 10,
            }}>
              {sector.etf}
            </span>

            <div style={{
              flex: 1,
              height: 10,
              background: 'rgba(255,255,255,0.03)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${barWidth}%`,
                background: barColor,
                opacity: 0.6,
                transition: 'width 0.5s ease',
              }} />
            </div>

            <span style={{
              fontFamily: BROADSHEET_TOKENS.fontMono,
              fontSize: 10,
              fontWeight: 600,
              color: barColor,
              width: 44,
              textAlign: 'right',
              flexShrink: 0,
            }}>
              {isPositive ? '+' : ''}{sector.changePercent.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
