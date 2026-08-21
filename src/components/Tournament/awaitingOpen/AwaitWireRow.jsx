// src/components/Tournament/awaitingOpen/AwaitWireRow.jsx
//
// Awaiting-the-Open redesign — ONE free-agent row, shared by the wire panel and
// the free-agent browser inside the claim sheet (§7.0 follow-up requirement 5:
// "a browsed name looks like a wire name"). Extracted verbatim from AwaitWire so
// there is a single row treatment rather than a lookalike: ticker plate, fit
// readout over its ticked rail, the rationale line, MOM / 1W / VOL.
//
// The two callers differ only in the trailing ACTION. The wire's action places a
// claim (opening the swap sheet pre-filled); the browser's action selects the
// name and carries it into the same drop-selection step. Both are described by
// the `action` prop, so neither surface owns a private variant of the row.

import React from 'react';
import { alpha } from './awaitTokens';
import { Mono, WChip, TickerPlate, TickRail, useAwaitPalette } from './awaitPrimitives';

/** Fit readout — the mono headline number over its own ticked rail. Both come
 *  from the single `fit` value, so the bar can never disagree with the number. */
export function FitScore({ fit, lead, compact, pal }) {
  const c = lead ? pal.teal : pal.ink;
  const v = Number.isFinite(fit) ? Math.round(fit) : null;
  return (
    <div style={{ width: compact ? 46 : 56, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <Mono style={{
          fontSize: compact ? 24 : 27, fontWeight: 700, lineHeight: 1, color: c, letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          textShadow: lead ? `0 0 20px ${alpha(pal.teal, 0.5)}` : 'none',
        }}>
          {v == null ? '—' : v}
        </Mono>
        <Mono style={{ fontSize: 8.5, fontWeight: 700, color: pal.ink3, letterSpacing: '0.1em' }}>FIT</Mono>
      </div>
      <div style={{ marginTop: 7 }}>
        <TickRail pct={v || 0} ticks={6} h={5} color={lead ? pal.teal : alpha(pal.teal, 0.75)} />
      </div>
    </div>
  );
}

/** MOM / 1W / VOL — the same three signals the classic list shows. */
export function StatStrip({ stock, compact, pal }) {
  const cell = (k, v, c) => (
    <span key={k} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
      <Mono style={{ fontSize: compact ? 8.5 : 9, fontWeight: 600, color: pal.ink3, letterSpacing: '0.12em' }}>{k}</Mono>
      <Mono style={{ fontSize: compact ? 10.5 : 11, fontWeight: 700, color: c || pal.ink2 }}>{v}</Mono>
    </span>
  );
  const w = stock.return1W;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: compact ? 11 : 14, flexWrap: 'wrap' }}>
      {cell('MOM', stock.momentumRank != null ? `#${stock.momentumRank}` : '—')}
      {cell('1W', w == null ? '—' : `${w >= 0 ? '+' : ''}${w.toFixed(1)}%`, w == null ? null : (w >= 0 ? pal.teal : pal.copper))}
      {cell('VOL', stock.volTxt || '—')}
    </div>
  );
}

/**
 * One free-agent row.
 *
 * `action` is `{ label, title, icon: Icon, disabled, tone, onAction }` — the
 * caller decides what the trailing control says and does. `highlight` paints the
 * lead/top-fit treatment; `badge` is an optional chip beside the ticker.
 */
export default function AwaitWireRow({
  stock,
  action,
  highlight = false,
  badge = null,
  queued = false,
  onResearch = null,
  compact = false,
  rankLabel = null,
}) {
  const pal = useAwaitPalette();
  const { label, title, icon: ActionIcon, disabled = false, tone = 'live', onAction } = action || {};
  const dim = disabled || tone === 'dim';
  const actionColor = tone === 'on' ? pal.teal : dim ? pal.ink3 : pal.teal;

  return (
    <div className={disabled ? undefined : 'aw-row'} style={{
      display: 'flex', alignItems: 'center', gap: compact ? 11 : 14,
      padding: compact ? '10px 12px' : '11px 14px', borderRadius: 14, minWidth: 0,
      background: queued ? alpha(pal.teal, 0.075) : highlight ? alpha(pal.white, 0.028) : alpha(pal.white, 0.014),
      border: `1px solid ${queued ? alpha(pal.teal, 0.34) : highlight ? alpha(pal.teal, 0.18) : pal.hair}`,
    }}>
      <FitScore fit={stock.fit} lead={highlight} compact={compact} pal={pal} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* research stays live even when claiming is gated (§6.1) */}
          <TickerPlate symbol={stock.symbol} sector={stock.sectorName} size="md" onResearch={onResearch} />
          {badge}
          {rankLabel && (
            <Mono style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: pal.ink3 }}>{rankLabel}</Mono>
          )}
        </div>
        {stock.reason && (
          <div style={{ fontSize: compact ? 11 : 11.5, color: pal.ink2, margin: '6px 0 5px', lineHeight: 1.35 }}>
            {stock.reason}
          </div>
        )}
        <StatStrip stock={stock} compact={compact} pal={pal} />
      </div>

      <button
        type="button"
        className="aw-btn"
        onClick={() => !disabled && onAction && onAction(stock)}
        disabled={disabled}
        title={title}
        aria-label={`${label} — ${title}`}
        style={{
          font: 'inherit', fontFamily: 'var(--ld-mono)', '--aw-btn-fs': compact ? '10px' : '10.5px', fontWeight: 700,
          letterSpacing: '0.1em', padding: compact ? '9px 12px' : '10px 15px', borderRadius: 10,
          whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: actionColor,
          background: tone === 'on' ? alpha(pal.teal, 0.1) : dim ? alpha(pal.white, 0.03) : alpha(pal.teal, 0.1),
          border: `1px solid ${tone === 'on' ? alpha(pal.teal, 0.34) : dim ? pal.hair2 : alpha(pal.teal, 0.45)}`,
          boxShadow: dim ? 'none' : `0 0 24px -14px ${alpha(pal.teal, 1)}`,
        }}
      >
        {ActionIcon && <ActionIcon size={12} color={actionColor} strokeWidth={2.2} />} {label}
      </button>
    </div>
  );
}
