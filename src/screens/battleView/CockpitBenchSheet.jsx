// src/screens/battleView/CockpitBenchSheet.jsx
//
// THE BENCH SHEET — Cockpit Build 2b, flag on (spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md §5.7; V5's 6A, ruling R2B-6). Opened from
// "Browse the bench →" (scoped to that call) or the Research pill (browse).
// It uses 2a's sheet (CockpitSheet.jsx useCockpitModal + CockpitModalLayer):
// a modal bottom sheet on the phone, a modal panel within the pane on desktop,
// focus trapped and restored, Escape closes.
//
//   rows      rank · symbol (+ "On {Agent}'s list") · sector · day % · ATR %
//             · the action — Pick ·● (scoped, available) · locked until {t}
//             · can't come in · no price · available (browse)
//   the note  the agent's OWN sentence about that name from its last check
//             that carries words (the Bench pane's selector), two lines,
//             expanded on tap; a row with no sentence shows nothing (V5-7)
//   research  tapping the symbol opens the EXISTING research modal over the
//             sheet (AssetResearchModal through handleSymbolClick); closing
//             it returns here. The modal gains nothing
//   a pick    files exactly what the same chip on the card would file — the
//             screen's answer flow, with the replace confirmation in place
//   filed     "✓ Filed · {canonical text}" with Done; every Pick waits
//   refused   a refused pick says why HERE, in a live region (§7.3) — the card
//             beneath is inert (review CB4-11)
//   suspended while the research modal stands over the sheet, the sheet traps
//             nothing and takes no key (review CB4-9, CB5-1)
//
// HAZARD 48: every label sizes an inner <span>. Tokens only; the layer's
// `smooth` entrance, `instant` under reduced motion.

import React from 'react';
import { X } from 'lucide-react';
import { cssVar } from '../../theme/cssTokens';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { parseEmphasis } from './selectWhyState';
import { plainButton, labelSpan } from './CockpitFeed';
import { useCockpitModal, CockpitModalLayer } from './CockpitSheet';
import { ReplaceConfirm } from './Cockpit2b';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const mono = (size, color = cssVar('text-secondary')) => ({ fontFamily: MONO, fontSize: size, color, lineHeight: 1.3 });
const dayColor = (tone) => (tone === 'up' ? cssVar('pos') : tone === 'down' ? cssVar('neg') : cssVar('text-secondary'));

/** The agent's note: its own sentence, verbatim, `**…**` as emphasis — two lines until tapped. */
function Note({ text }) {
  const [open, setOpen] = React.useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      data-cockpit-bench-note="1"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      style={{ ...plainButton, display: 'block', width: '100%', minHeight: 24 }}
    >
      <span
        style={{
          // Block-level in both states: inline inside the 16px-forced button it would take the button's line
          // height when expanded (review CB5-8).
          display: open ? 'block' : '-webkit-box',
          fontSize: 11.5,
          lineHeight: 1.4,
          color: cssVar('text-secondary'),
          whiteSpace: 'pre-wrap',
          ...(open ? {} : { WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
        }}
      >
        {parseEmphasis(text).map((part, i) => (part.strong
          ? <strong key={i} style={{ color: cssVar('text-primary'), fontWeight: 700 }}>{part.text}</strong>
          : <span key={i}>{part.text}</span>))}
      </span>
    </button>
  );
}

function RowAction({ action, onPick, symbol }) {
  if (action.kind === 'pick') {
    return (
      <button
        type="button"
        data-cockpit-bench-pick={symbol}
        aria-label={action.disabled ? action.label : action.aria}
        aria-disabled={action.disabled ? 'true' : undefined}
        onClick={() => { if (!action.disabled) onPick(symbol); }}
        style={{
          background: 'transparent',
          border: `1px solid ${cssVar('call-yours')}`,
          color: cssVar('call-yours'),
          borderRadius: 14,
          padding: '4px 10px',
          minHeight: 28,
          cursor: action.disabled ? 'default' : 'pointer',
          opacity: action.disabled ? 0.45 : 1,
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <span style={labelSpan(11.5)}>{action.label}</span>
        {action.dot ? <span aria-hidden="true" data-cockpit-bullet="1" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: cssVar('teal'), marginLeft: 6 }} /> : null}
      </button>
    );
  }
  // Informational text, so it keeps 4.5:1 — the secondary token, as 2a's L5-9 fix (review CB5-7).
  return <span data-cockpit-bench-status={action.kind} style={{ ...mono(10), textAlign: 'right', color: cssVar('text-secondary') }}>{action.label}</span>;
}

/**
 * @param {object} props
 * @param {object|null} props.sheet   cockpit2bModel.benchSheetOf(...) — null renders nothing
 * @param {(key: string) => void} props.onSort
 * @param {(symbol: string) => void} props.onPick
 * @param {(symbol: string) => void} props.onResearch   the screen's research door (handleSymbolClick)
 * @param {string|null} props.confirmLine   the replace confirmation (§6.3), when a pick here asked first
 */
export default function CockpitBenchSheet({
  sheet,
  isDesktop = false,
  reducedMotion = false,
  bottomInset = 0,
  restoreFocus = null,
  onClose,
  onSort,
  onPick,
  onResearch,
  confirmLine = null,
  confirmSending = false,
  onConfirmReplace = null,
  onConfirmKeep = null,
  suspended = false,
  onSuspendedEscape = null,
}) {
  const open = Boolean(sheet);
  const titleId = 'cockpit-bench-title';
  const { panelRef, onKeyDown } = useCockpitModal({ open, onClose, restoreFocus, suspended, onSuspendedEscape });
  if (!open) return null;
  const phone = !isDesktop;
  const columns = phone ? '18px minmax(0, 1fr) 46px 54px 84px' : '26px minmax(0, 1fr) 56px 64px 104px';

  return (
    <CockpitModalLayer kind="bench" isDesktop={isDesktop} reducedMotion={reducedMotion} bottomInset={bottomInset} titleId={titleId} panelRef={panelRef} onKeyDown={onKeyDown} onClose={onClose} suspended={suspended}>
      {sheet.filedBar ? (
        <div data-cockpit-bench-filed="1" role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: `rgba(var(--ft-teal-rgb), 0.08)` }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: cssVar('text-primary'), lineHeight: 1.4 }}>{sheet.filedBar}</span>
          <button type="button" data-cockpit-bench-done="1" onClick={onClose} style={{ background: 'transparent', border: `1px solid ${cssVar('call-yours')}`, color: cssVar('call-yours'), borderRadius: 14, padding: '4px 12px', minHeight: 28, cursor: 'pointer' }}>
            <span style={labelSpan(11.5)}>{sheet.done}</span>
          </button>
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>{sheet.title}</h2>
          {sheet.sub ? <span data-cockpit-bench-sub="1" style={mono(10.5)}>{sheet.sub}</span> : null}
        </div>
        <button
          type="button"
          data-cockpit-bench-close="1"
          aria-label={COPY.cockpit2bBenchClose}
          onClick={onClose}
          style={{ minWidth: 36, minHeight: 36, border: 'none', background: 'transparent', color: cssVar('text-muted'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={18} />
        </button>
      </div>
      <div role="group" aria-label={COPY.cockpit2bSortName} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {sheet.sorts.map((s) => (
          <button
            key={s.key}
            type="button"
            data-cockpit-bench-sort={s.key}
            aria-pressed={s.on}
            onClick={() => onSort?.(s.key)}
            style={{
              background: s.on ? `rgba(var(--ft-teal-rgb), 0.12)` : 'transparent',
              border: `1px solid ${s.on ? cssVar('teal') : `rgba(var(--ft-scrim-rgb), 0.2)`}`,
              color: s.on ? cssVar('teal') : cssVar('text-secondary'),
              borderRadius: 14,
              padding: '4px 10px',
              minHeight: 28,
              cursor: 'pointer',
            }}
          >
            <span style={labelSpan(11)}>{s.label}</span>
          </button>
        ))}
      </div>
      {sheet.loading ? <span role="status" data-cockpit-bench-loading="1" style={{ fontSize: 12.5, color: cssVar('text-secondary') }}>{sheet.loading}</span> : null}
      {sheet.error ? <span role="status" data-cockpit-bench-error="1" style={{ fontSize: 12.5, color: cssVar('text-secondary') }}>{sheet.error}</span> : null}
      {sheet.noneLeft ? <span role="status" style={{ fontSize: 11.5, color: cssVar('amber') }}>{sheet.noneLeft}</span> : null}
      {confirmLine ? <ReplaceConfirm line={confirmLine} phone={phone} sending={confirmSending} onReplace={onConfirmReplace} onKeep={onConfirmKeep} /> : null}
      <div role="status" aria-live="polite" data-cockpit-bench-refusal={sheet.refusalLine ? '1' : '0'} style={{ fontSize: 11.5, color: cssVar('call-dropped'), minHeight: sheet.refusalLine ? undefined : 0 }}>
        {sheet.refusalLine}
      </div>
      {sheet.rows.length > 0 ? (
        <div data-cockpit-bench-rows="1" role="list">
          {sheet.rows.map((r) => (
            <div
              key={r.symbol}
              role="listitem"
              data-cockpit-bench-row={r.symbol}
              data-cockpit-bench-row-status={r.action.kind}
              style={{
                display: 'grid',
                gridTemplateColumns: columns,
                alignItems: 'center',
                gap: phone ? 6 : 10,
                minHeight: 48,
                padding: '6px 0',
                borderBottom: `1px solid rgba(var(--ft-scrim-rgb), 0.07)`,
              }}
            >
              <span style={mono(10.5)}>{r.rank}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <button
                  type="button"
                  data-cockpit-bench-research={r.symbol}
                  aria-label={COPY.cockpit2bResearchSymbol(r.symbol)}
                  onClick={() => onResearch?.(r.symbol)}
                  style={{ ...plainButton, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: phone ? 'wrap' : 'nowrap', minHeight: 24 }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: cssVar('text-primary'), lineHeight: 1.2 }}>{r.symbol}</span>
                  {r.onAgentList ? (
                    <span data-cockpit-bench-agent-list="1" style={{ ...mono(8.5, cssVar('teal')), border: `1px solid rgba(var(--ft-teal-rgb), 0.5)`, borderRadius: 5, padding: '0 5px', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{sheet.agentListLabel}</span>
                  ) : null}
                </button>
                <span style={{ fontSize: 10.5, color: cssVar('text-secondary'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sector}</span>
                <Note text={r.note} />
              </div>
              <span style={{ ...mono(11.5, dayColor(r.dayTone)), fontWeight: 700, textAlign: 'right' }}>{r.day}</span>
              <span style={{ ...mono(10.5), textAlign: 'right' }}>{r.atr}</span>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <RowAction action={r.action} symbol={r.symbol} onPick={onPick} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </CockpitModalLayer>
  );
}
