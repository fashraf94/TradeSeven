// src/components/Tournament/awaitingOpen/FreeAgentsList.jsx
//
// Training Pod Draft V2 — Phase 2, L7. The archetype's "best remaining free
// agents": the SAME fit-ranked board data as the draft lobby (buildFitBoard),
// sliced to the pod's user-pool-available names (the ranked universe minus the
// 12 drafted — already pod.userPool at AWAITING_OPEN), top ~12, with the same
// Fit bars + MOM / 1W / VOL. The ticker opens research (research-only here); each
// row's inline Claim button pre-fills the claim builder below and scrolls to it.
// If 3 claims are already pending, the Claim buttons disable with a hint;
// pre-fill is always allowed when open, and placement stays server-gated on the
// wire (the builder's existing behavior).

import React from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { Gavel } from 'lucide-react';
import { FitBar, ReturnPct, Mono } from '../../League/draft/draftPrimitives';
import { SectorChip, SectionHead } from './podPrimitives';

function Signals({ tokens, stock }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 5 }}>
      <span style={{ fontSize: 10.5, color: tokens.textFaint }}>MOM <span style={{ color: tokens.textSecondary, fontWeight: 600 }}>{stock.momentumRank != null ? `#${stock.momentumRank}` : '—'}</span></span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: tokens.textFaint }}>1W <ReturnPct v={stock.return1W} size={10.5} /></span>
      <span style={{ fontSize: 10.5, color: tokens.textFaint }}>VOL <span style={{ color: tokens.textSecondary, fontWeight: 600 }}>{stock.volTxt || '—'}</span></span>
    </div>
  );
}

export default function FreeAgentsList({ board = [], onResearch = null, onClaim = null, capReached = false, pendingCount = 0, claimCap = 3 }) {
  const { tokens } = useTheme();

  if (!board.length) return null;

  return (
    <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 12, padding: 14 }}>
      <SectionHead
        tokens={tokens}
        eyebrow="Waiver wire"
        title="Best remaining free agents"
        note="Ranked for your agent from the names still available. Tap a ticker to research; Claim to line up an overnight swap."
        right={<Mono style={{ fontSize: 10.5, color: tokens.textFaint }}>{pendingCount}/{claimCap} pending</Mono>}
      />

      {capReached && (
        <div style={{ fontSize: 11, color: tokens.amber, marginBottom: 10 }}>
          You have {claimCap} pending claims — wait for tonight’s processing before lining up another.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {board.map((stock) => (
          <div key={stock.symbol} style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            padding: '11px 12px', borderRadius: 11, background: tokens.bgElevated, border: `1px solid ${tokens.borderDivider}`,
          }}>
            {/* identity */}
            <div style={{ minWidth: 128, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SectorChip symbol={stock.symbol} sector={stock.sectorName} size="m" onResearch={onResearch} />
            </div>
            {/* reason + signals */}
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 12.5, color: tokens.textSecondary, lineHeight: 1.4 }}>{stock.reason}</div>
              <Signals tokens={tokens} stock={stock} />
            </div>
            {/* fit */}
            <div style={{ width: 168, flexShrink: 0 }}>
              <FitBar fit={stock.fit} tier={stock.tier} w={104} />
            </div>
            {/* claim */}
            <button
              type="button"
              onClick={() => !capReached && onClaim && onClaim(stock.symbol)}
              disabled={capReached}
              title={capReached ? `Wait for processing — ${claimCap} pending` : `Pre-fill a claim for ${stock.symbol}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 13px', borderRadius: 9,
                border: `1px solid ${capReached ? tokens.borderDivider : `${tokens.teal}66`}`,
                background: capReached ? 'transparent' : `${tokens.teal}1a`,
                color: capReached ? tokens.textFaint : tokens.teal,
                fontWeight: 700, fontSize: 12.5, cursor: capReached ? 'not-allowed' : 'pointer', flexShrink: 0,
              }}
            >
              <Gavel size={13} /> Claim
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
