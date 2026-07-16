// src/components/Tournament/awaitingOpen/UserDraftboard.jsx
//
// Training Pod Draft V2 — Phase 2, L6. The classic fantasy draftboard for the
// USER layer only: rounds as rows × the four seats as columns, sector-colored
// chips, your column highlighted, every chip's ticker → AssetResearchModal.
// The agent (Monday) draft show is a SEPARATE spectator surface and is not on
// this board. Seat labels mirror the lobby's left rail: "You" + "CPU {seatIdx}".

import React, { useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { buildDraftGrid } from './podBoard';
import { SectorChip, SectionHead } from './podPrimitives';

export default function UserDraftboard({ pod, uid, events, sectorMap, picksPerPlayer = 3, onResearch = null }) {
  const { tokens } = useTheme();
  const members = useMemo(() => pod?.groupMembers || [], [pod?.groupMembers]);

  const seatLabel = (odUserId, seatIdx) => (odUserId === uid ? 'You' : `CPU ${seatIdx}`);

  const grid = useMemo(
    () => buildDraftGrid({ events, groupMembers: members, picksPerPlayer }),
    [events, members, picksPerPlayer],
  );

  if (members.length === 0) return null;

  const youIdx = members.indexOf(uid);
  const cellSector = (sym) => (sym ? (sectorMap?.get(sym) || 'Other') : null);

  return (
    <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 12, padding: 14 }}>
      <SectionHead tokens={tokens} eyebrow="The draft" title="Your league draftboard"
        note="The 12 user-layer picks — who took what. Tap any ticker to research it." />

      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `36px repeat(${members.length}, minmax(96px, 1fr))`, gap: 6, minWidth: members.length * 104 + 36 }}>
          {/* header row: seat labels */}
          <div />
          {members.map((odUserId, seatIdx) => {
            const you = odUserId === uid;
            return (
              <div key={`h-${odUserId}`} style={{
                textAlign: 'center', padding: '6px 4px', borderRadius: 8,
                background: you ? `${tokens.teal}1f` : 'transparent',
                border: `1px solid ${you ? `${tokens.teal}4d` : 'transparent'}`,
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: you ? tokens.teal : tokens.textSecondary }}>{seatLabel(odUserId, seatIdx)}</div>
              </div>
            );
          })}

          {/* round rows */}
          {grid.map((row, rIdx) => (
            <React.Fragment key={`r-${rIdx}`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: tokens.textFaint, fontVariantNumeric: 'tabular-nums' }}>
                R{rIdx + 1}
              </div>
              {row.map((cell, seatIdx) => {
                const you = seatIdx === youIdx;
                return (
                  <div key={`c-${rIdx}-${seatIdx}`} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 5px', minHeight: 40,
                    borderRadius: 8, background: you ? `${tokens.teal}12` : tokens.bgElevated,
                    border: `1px solid ${you ? `${tokens.teal}3d` : tokens.borderDivider}`,
                  }}>
                    {cell ? (
                      <SectorChip symbol={cell.symbol} sector={cellSector(cell.symbol)} size="s" onResearch={onResearch} highlight={you} />
                    ) : (
                      <span style={{ fontSize: 12, color: tokens.textFaint }}>—</span>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
