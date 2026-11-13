// src/components/Research/Sheet/ShellHeader.jsx
//
// The two-view shell's HEADER (Amendment C R-27, H1; spec
// docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-3), rendered by ChartHeader.jsx
// when the shell is on (its `shell` prop). It lives in Sheet/ so the sheet's
// colour and motion guard (sheet.guards.test.js) scans it (review D9).
//
//   the stock row  back (after a navigation) · symbol · name · price · the day's change · close
//   the pills      filled pills of equal width with space between them — Analysis · Chart · 💣
//                  in battle, Analysis · Chart in browse — the active one filled. The 💣 pill
//                  warms with Bomb mode's heat accent while the view model is in a live zone.
// No Why? door (R-27): What's moving is the Analysis view's first tab.
//
// src/index.css forces every <button>'s own font-size to 16px: a label's size sits on a span.

import React from 'react';
import { priceText } from '../priceFormat';
import { ST, MONO, tint } from './sheetTheme';
import { SHELL_COPY } from './sheetCopy';
import { HEAT } from '../BombMode/bombTheme';

/** BS-3 — the stock row's price and change sizes: their floors at 320 px, their old sizes from 390 px up. */
export const SHELL_PRICE_FONT = 'clamp(12px, 3.6vw, 14px)';
export const SHELL_CHANGE_FONT = 'clamp(10px, 2.95vw, 11.5px)';

export function ShellPills({ views, active, onView, warm }) {
  return (
    <div role="tablist" aria-label={SHELL_COPY.viewsLabel} data-shell-pills={views.length} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {views.map((v) => {
        const on = v === active;
        const bomb = v === 'bomb';
        const heat = bomb && warm === true && !on;
        const accent = bomb ? ST.amber : ST.teal;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={on}
            data-shell-pill={v}
            {...(bomb ? { 'aria-label': SHELL_COPY.viewBombLabel, 'data-shell-pill-warm': heat ? '1' : '0' } : {})}
            onClick={() => { if (!on) onView(v); }}
            style={{
              all: 'unset', boxSizing: 'border-box', cursor: 'pointer', flex: 1, minWidth: 0, minHeight: 44, borderRadius: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, whiteSpace: 'nowrap',
              color: on ? ST.bg : ST.ink2,
              background: on ? accent : heat ? tint(HEAT, 16) : 'transparent',
              border: `1px solid ${on ? accent : heat ? tint(HEAT, 70) : ST.hair}`,
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>{v === 'analysis' ? SHELL_COPY.viewAnalysis : v === 'chart' ? SHELL_COPY.viewChart : SHELL_COPY.viewBomb}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The change pill is the DAY's change only (`shell.change`, the research hook's daily change),
 * shown once known: a battle asset's own percentChange can be its change since entry, so it is
 * never the fallback here (BUILD_RULES §9; What's moving's title reads the same number).
 * @param {object} p
 * @param {object} p.asset   the modal's shown asset (symbol, name, price)
 * @param {object} p.shell   { views, active, onView, warm, change }
 */
export default function ShellHeader({ asset, onClose, onBack, shell }) {
  const priceChange = typeof shell.change === 'number' && Number.isFinite(shell.change) ? shell.change : null;
  const up = priceChange === null || priceChange >= 0;
  const tone = up ? ST.green : ST.red;
  return (
    <div data-shell-header style={{ flexShrink: 0, background: ST.bg, borderBottom: `1px solid ${ST.hair}` }}>
      {/* Only the name shrinks in this row (6 px gaps keep the 36 px back and 44 px close boxes —
          review D5 — beside a long symbol, refuter D6); the price and change narrow with the screen (BS-3). */}
      <div data-shell-stock-row style={{ height: 52, display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px 0 12px' }}>
        {onBack && (
          <button type="button" data-shell-back aria-label={SHELL_COPY.headerBack} onClick={onBack} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', color: ST.teal, minWidth: 36, minHeight: 44, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{'←'}</span>
          </button>
        )}
        {/* Review D1: the symbol may ellipsize too — only once the name is gone (a tiny shrink weight) —
            so ✕ stays on screen whatever the font, not by measured margin alone. */}
        <span data-shell-symbol style={{ fontSize: 17, fontWeight: 800, color: ST.ink, whiteSpace: 'nowrap', minWidth: 0, flexShrink: 0.001, overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.symbol}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: ST.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.name}</span>
        {/* BS-3: the price and the change narrow with the screen (as the tabs' labels do) — 14 and 11.5 px
            from 390 px up, 12 and 10 px at 320 — so a six-figure price and a back arrow keep ✕'s box inside. */}
        <span data-shell-price style={{ fontFamily: MONO, fontSize: SHELL_PRICE_FONT, fontWeight: 700, color: ST.ink, whiteSpace: 'nowrap' }}>${priceText(asset.price) || '—'}</span>
        {priceChange !== null && (
          <span data-shell-change style={{ fontFamily: MONO, fontSize: SHELL_CHANGE_FONT, fontWeight: 700, color: tone, background: tint(tone, 14), borderRadius: 999, padding: '4px 8px', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
            {up ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
          </span>
        )}
        <button type="button" data-shell-close aria-label={SHELL_COPY.headerClose} onClick={onClose} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: ST.ink2 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{'✕'}</span>
        </button>
      </div>
      <div style={{ padding: '0 14px 12px' }}>
        <ShellPills views={shell.views} active={shell.active} onView={shell.onView} warm={shell.warm} />
      </div>
    </div>
  );
}
