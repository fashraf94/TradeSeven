// src/components/League/draft/StockCard.jsx
//
// THE stock card — fit + reason + a couple of signals, with on-tap depth.
// Ported from the design's StockCard (draft-parts.jsx); the doc is ticker-only,
// so the identity leads with the symbol (no company name — spec §1.4). `stock`
// is a row from buildFitBoard (boardModel.js).

import React from 'react';
import { TOKENS, DX, alpha, fitColor } from './draftTokens';
import { Icon } from './draftIcons';
import { Mono, SectorTag, ReturnPct, FitBar } from './draftPrimitives';

export function StockCard({ stock, selected, onSelect, expanded, onExpand, size = 'd', dim = false, disabled = false }) {
  const c = fitColor(stock.tier);
  const big = size === 'd';
  const signals = (small) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
      <Mono style={{ fontSize: small ? 10 : 10.5, color: TOKENS.ink3 }}>MOM <span style={{ color: TOKENS.ink2 }}>{stock.momentumRank != null ? `#${stock.momentumRank}` : '—'}</span></Mono>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Mono style={{ fontSize: small ? 10 : 10.5, color: TOKENS.ink3 }}>1W</Mono><ReturnPct v={stock.return1W} size={small ? 10 : 10.5} />
      </span>
      <Mono style={{ fontSize: small ? 10 : 10.5, color: TOKENS.ink3 }}>VOL <span style={{ color: TOKENS.ink2 }}>{stock.volTxt}</span></Mono>
    </div>
  );

  return (
    <div className="ld-tap" onClick={() => !disabled && onSelect(stock.symbol)} style={{ borderRadius: 14, position: 'relative', cursor: disabled ? 'default' : 'pointer',
      background: selected ? alpha(DX.you, 0.09) : TOKENS.surface,
      border: `1.4px solid ${selected ? DX.you : TOKENS.hair}`,
      boxShadow: selected ? `0 0 0 3px ${alpha(DX.you, 0.12)}, 0 8px 28px ${alpha(DX.you, 0.1)}` : 'none',
      opacity: dim ? 0.5 : 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: big ? 13 : 11, padding: big ? '12px 14px' : '11px 12px' }}>
        {/* rank pip */}
        <div style={{ width: big ? 26 : 23, height: big ? 26 : 23, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: stock.tier === 'top' ? alpha(DX.you, 0.14) : TOKENS.bg, border: `1px solid ${stock.tier === 'top' ? alpha(DX.you, 0.3) : TOKENS.hair}` }}>
          <Mono style={{ fontSize: 11, fontWeight: 700, color: stock.tier === 'top' ? DX.you : TOKENS.ink2 }}>{stock.boardRank}</Mono>
        </div>
        {/* identity (ticker-only) */}
        <div style={{ width: big ? 130 : 96, flexShrink: 0, minWidth: 0 }}>
          <span style={{ fontSize: big ? 16 : 15, fontWeight: 700, color: TOKENS.ink, letterSpacing: '-0.01em' }}>{stock.symbol}</span>
          <div style={{ marginTop: 5 }}><SectorTag sector={stock.sectorName} /></div>
        </div>
        {/* reason (desktop) */}
        {big && (
          <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <div style={{ fontSize: 12.5, color: stock.tier === 'reach' ? TOKENS.ink3 : TOKENS.ink2, lineHeight: 1.4 }}>{stock.reason}</div>
            {signals(false)}
          </div>
        )}
        {/* fit */}
        <div style={{ width: big ? 176 : 96, flexShrink: 0 }}>
          {big ? <FitBar fit={stock.fit} tier={stock.tier} w={110} />
            : <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, justifyContent: 'flex-end' }}>
                <Mono style={{ fontSize: 20, fontWeight: 700, color: c, lineHeight: 1 }}>{stock.fit}</Mono>
                <Mono style={{ fontSize: 9, color: TOKENS.ink3 }}>fit</Mono>
              </div>}
        </div>
        {/* expand */}
        <button className="ld-tap" onClick={(e) => { e.stopPropagation(); onExpand(expanded ? null : stock.symbol); }}
          style={{ all: 'unset', cursor: 'pointer', width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: TOKENS.bg, border: `1px solid ${TOKENS.hair}`, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>
          <Icon name="chevD" size={14} color={TOKENS.ink2} />
        </button>
      </div>
      {/* mobile reason row */}
      {!big && (
        <div style={{ padding: '0 12px 11px 46px', marginTop: -3 }}>
          <div style={{ fontSize: 12, color: stock.tier === 'reach' ? TOKENS.ink3 : TOKENS.ink2, lineHeight: 1.4 }}>{stock.reason}</div>
          {signals(true)}
        </div>
      )}
      {/* expanded depth */}
      {expanded && (
        <div style={{ padding: big ? '0 14px 13px 53px' : '0 12px 12px 46px', animation: 'ldFadeIn .2s ease both' }}>
          <div style={{ height: 1, background: TOKENS.hair, marginBottom: 11 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 11 }}>
            {[['1W', stock.return1W], ['1M', stock.return1M], ['3M', stock.return3M], ['YTD', stock.returnYTD]].map(([k, v]) => (
              <div key={k} style={{ background: TOKENS.bg, borderRadius: 9, padding: '8px 9px', border: `1px solid ${TOKENS.hair}` }}>
                <Mono style={{ fontSize: 9.5, color: TOKENS.ink3, letterSpacing: '0.08em' }}>{k}</Mono>
                <div style={{ marginTop: 3 }}><ReturnPct v={v} size={13} /></div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {[['Composite', stock.compositeScore != null ? `${Math.round(stock.compositeScore)} / 100` : '—'], ['Momentum rank', stock.momentumRank != null ? `#${stock.momentumRank}` : '—'], ['Volatility', stock.volTxt]].map(([k, v]) => (
              <div key={k}>
                <Mono style={{ fontSize: 9.5, color: TOKENS.ink3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{k}</Mono>
                <div style={{ fontSize: 13, color: TOKENS.ink, fontWeight: 600, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default StockCard;
