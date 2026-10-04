// src/screens/battleView/CockpitFeed.jsx
//
// THE COCKPIT FEED — Cockpit Build 2a (spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md
// §5 top row, §7 tiles, §8 copy, §9 styling). One component for both shells:
// the desktop pane's Cockpit tab and the phone's Cockpit screen.
//
// IT RENDERS THE MODEL AND NOTHING ELSE. Every tile, tag, line, button and
// refusal line arrives from cockpitModel.js (records in, tiles out); this file
// only lays them out, in the shipped language — group headers in the
// tier-header treatment, a state dot per tile, the transparent teal-outline
// chip (WhyPanel's "Ask a follow-up · 1 message"), tokens only (`--ft-*`, the
// four `--ft-call-*` state aliases). No motion of its own.
//
// A TAP ON A BUTTON answers through the screen (no optimistic state: the
// tile changes when the listener delivers the record); a tap on the tile's
// body opens its sheet. A refusal shows one line under its tile, in a polite
// live region (§7.3). A button that waits (an answer in flight, or the one-
// call-at-a-time block) is `aria-disabled`, never `disabled`: a pressed button
// keeps focus while it sends (review L5-5).
//
// NOTHING IS CLAIMED BEFORE THE RECORDS ARRIVE (review L3-2): while the
// readers load, the feed shows no empty line and no tile; a failed read shows
// one neutral line, never "No calls yet".
//
// HAZARD 48: index.css forces every <button> to 16px !important, so every
// label sizes an inner <span>. The tile body is a plain button reset by hand —
// never `all: unset`, which would also take the keyboard focus ring (review
// L5-3).

import React from 'react';
import { cssVar } from '../../theme/cssTokens';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** A tone (the fact table's) as a token colour (§9, ruling R2A-5). */
export function toneColor(tone) {
  switch (tone) {
    case 'yours':
    case 'yoursOutline': return cssVar('call-yours');
    case 'acted': return cssVar('call-acted');
    case 'dropped': return cssVar('call-dropped');
    case 'muted': return cssVar('call-muted');
    default: return cssVar('text-secondary');
  }
}

const labelSpan = (size, weight = 600) => ({ fontSize: size, fontWeight: weight, lineHeight: 1.2 });

/** A button reset by hand (no `all: unset`): the browser keeps its focus ring. */
export const plainButton = Object.freeze({
  background: 'transparent',
  border: 'none',
  margin: 0,
  padding: 0,
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
});

function GroupHeader({ label, count = null, dim = false, groupKey }) {
  return (
    <div
      data-cockpit-group={groupKey}
      role="heading"
      aria-level={3}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px 6px',
        position: 'sticky',
        top: 0,
        zIndex: 2,
        background: `linear-gradient(90deg, rgba(var(--ft-teal-rgb), ${dim ? 0.04 : 0.1}), rgba(var(--ft-shadow-rgb), 0.85) 55%)`,
        backdropFilter: 'blur(8px)',
      }}
    >
      <span style={{
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        // Small text at the muted base is under 4.5:1 here; the secondary text
        // token keeps the dim header legible (review L5-9).
        color: dim ? cssVar('text-secondary') : cssVar('teal'),
      }}
      >
        {label}
      </span>
      {count !== null && count > 0 ? (
        <span style={{
          fontFamily: MONO,
          fontSize: 10,
          fontWeight: 700,
          color: dim ? cssVar('text-secondary') : cssVar('teal'),
          background: `rgba(var(--ft-teal-rgb), ${dim ? 0.05 : 0.12})`,
          padding: '2px 8px',
          borderRadius: 6,
          letterSpacing: '0.04em',
        }}
        >
          {count}
        </span>
      ) : null}
    </div>
  );
}

/** The shipped transparent teal-outline chip (WhyPanel.jsx's follow-up door). */
const chipStyle = (disabled) => ({
  background: 'transparent',
  border: `1px solid ${cssVar('call-yours')}`,
  color: cssVar('call-yours'),
  borderRadius: 16,
  padding: '6px 12px',
  minHeight: 36,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.45 : 1,
  textAlign: 'center',
});

export function AnswerButtons({ buttons, onAnswer }) {
  if (!Array.isArray(buttons) || buttons.length === 0) return null;
  return (
    <div data-cockpit-buttons="1" style={{ display: 'grid', gridTemplateColumns: `repeat(${buttons.length}, minmax(0, 1fr))`, gap: 8 }}>
      {buttons.map((b) => (
        <button
          key={b.answer}
          type="button"
          data-cockpit-answer={b.answer}
          data-cockpit-row={b.row}
          aria-disabled={b.disabled ? 'true' : undefined}
          onClick={(e) => { e.stopPropagation(); if (!b.disabled) onAnswer?.(b.callId, b.answer); }}
          style={chipStyle(b.disabled)}
        >
          <span style={labelSpan(12)}>{b.label}</span>
        </button>
      ))}
    </div>
  );
}

export function StateTag({ tag }) {
  if (!tag || !tag.text) return null;
  const color = toneColor(tag.tone);
  return (
    <span
      data-cockpit-tag={tag.fact}
      data-cockpit-tone={tag.tone}
      style={{
        fontFamily: MONO,
        fontSize: 9.5,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontWeight: 600,
        color,
        whiteSpace: 'nowrap',
        ...(tag.tone === 'yoursOutline' ? { border: `1px solid ${color}`, borderRadius: 6, padding: '1px 6px' } : {}),
      }}
    >
      {tag.text}
    </span>
  );
}

function Tile({ tile, onAnswer, onOpenSheet }) {
  const dot = toneColor(tile.tag?.tone);
  const refusal = tile.refusalLine ?? null;
  const openSheet = () => onOpenSheet?.(tile.id);
  return (
    <div
      data-cockpit-tile={tile.id}
      data-cockpit-tile-group={tile.group}
      style={{
        position: 'relative',
        display: 'flex',
        gap: 10,
        padding: '10px 12px 12px',
        borderBottom: `1px solid rgba(var(--ft-scrim-rgb), 0.07)`,
        background: `rgba(var(--ft-shadow-rgb), 0.18)`,
      }}
    >
      <div style={{ width: 10, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 5 }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: dot, boxShadow: tile.tag?.tone === 'muted' ? 'none' : `0 0 8px ${dot}` }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <button
          type="button"
          data-cockpit-tile-open="1"
          aria-haspopup="dialog"
          onClick={openSheet}
          style={{ ...plainButton, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, width: '100%' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
            <span style={{
              fontFamily: MONO,
              fontSize: 9.5,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: tile.upside ? cssVar('text-secondary') : cssVar('teal'),
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            >
              {tile.kindLabel}
              {tile.eyebrow ? (
                <span style={{ color: cssVar('text-secondary'), fontWeight: 500, letterSpacing: '0.02em', textTransform: 'none' }}>
                  {' · '}
                  {tile.eyebrow}
                </span>
              ) : null}
            </span>
            <StateTag tag={tile.tag} />
          </span>
          <span data-cockpit-line="1" style={{ fontSize: 14.5, fontWeight: 700, color: cssVar('text-primary'), lineHeight: 1.35 }}>
            {tile.line}
          </span>
          {tile.restated ? (
            <span data-cockpit-restated="1" style={{ fontFamily: MONO, fontSize: 10.5, color: cssVar('text-secondary') }}>{tile.restated}</span>
          ) : null}
          {tile.answerLine ? (
            <span data-cockpit-thread-answer="1" style={{ fontSize: 12, color: cssVar('call-yours') }}>{tile.answerLine}</span>
          ) : null}
        </button>
        <AnswerButtons buttons={tile.buttons} onAnswer={onAnswer} />
        {tile.blockedLine ? (
          <span data-cockpit-blocked="1" style={{ fontSize: 11.5, color: cssVar('text-secondary') }}>{tile.blockedLine}</span>
        ) : null}
        <div role="status" aria-live="polite" data-cockpit-refusal={refusal ? '1' : '0'} style={{ fontSize: 11.5, color: cssVar('call-dropped'), minHeight: refusal ? undefined : 0 }}>
          {refusal}
        </div>
      </div>
    </div>
  );
}

function MonitoringRow({ row, onSymbolClick }) {
  if (!row) return null;
  return (
    <div data-cockpit-monitoring="1" style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {row.from ? <span style={{ fontFamily: MONO, fontSize: 10.5, color: cssVar('text-secondary') }}>{row.from}</span> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {row.chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            data-cockpit-monitoring-symbol={chip.symbol}
            aria-label={COPY.cockpitMonitoringChipName(chip.symbol)}
            onClick={() => onSymbolClick?.(chip.symbol)}
            style={{ ...chipStyle(false), padding: '4px 12px' }}
          >
            <span style={labelSpan(12, 700)}>{chip.symbol}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {object} props.feed         buildCockpitFeed(...) — every tile carries its own refusal line
 * @param {'loading'|'ready'|'error'} [props.status]  the calls + events readers' state (review L3-2)
 * @param {object|null} props.monitoring  monitoringRow(...)
 * @param {{ vintage: string|null, messagesLeft: string|null }|null} props.topRow  desktop only
 * @param {string} props.emptyLine    the empty state's line (shown only once the records are READY)
 */
export default function CockpitFeed({
  feed,
  status = 'ready',
  monitoring = null,
  topRow = null,
  emptyLine = null,
  onAnswer,
  onOpenSheet,
  onSymbolClick,
  onShowAllEarlier,
  showAllEarlier = false,
}) {
  const rootRef = React.useRef(null);
  const focusAfterExpand = React.useRef(null);
  const ready = status === 'ready';
  const hasCalls = ready && feed && (feed.needsYou.length + feed.waiting.length + feed.earlierTotal) > 0;

  // "Show all" removes itself when pressed: focus moves to the first tile it
  // revealed, never to <body> (review L5-5).
  React.useEffect(() => {
    if (!showAllEarlier || focusAfterExpand.current === null) return;
    const index = focusAfterExpand.current;
    focusAfterExpand.current = null;
    const tiles = rootRef.current?.querySelectorAll('[data-cockpit-tile-group="earlier"] [data-cockpit-tile-open]');
    tiles?.[index]?.focus?.();
  }, [showAllEarlier]);

  return (
    <div ref={rootRef} data-cockpit-feed="1" data-cockpit-status={status} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {topRow ? (
        <div
          data-cockpit-top-row="1"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '8px 14px',
            borderBottom: `1px solid rgba(var(--ft-scrim-rgb), 0.07)`,
            fontFamily: MONO,
            fontSize: 10.5,
            color: cssVar('text-secondary'),
          }}
        >
          <span data-cockpit-vintage="1">{topRow.vintage}</span>
          {topRow.messagesLeft ? (
            <span data-cockpit-messages-left="1" style={{ whiteSpace: 'nowrap' }}>{topRow.messagesLeft}</span>
          ) : null}
        </div>
      ) : null}
      {status === 'error' ? (
        <div data-cockpit-read-error="1" style={{ padding: '18px 14px', fontSize: 13, color: cssVar('text-secondary'), lineHeight: 1.45 }}>{COPY.cockpitReadError}</div>
      ) : null}
      {ready && !hasCalls && !monitoring ? (
        <div data-cockpit-empty="1" style={{ padding: '18px 14px', fontSize: 13, color: cssVar('text-secondary'), lineHeight: 1.45 }}>{emptyLine}</div>
      ) : null}
      {ready && feed && feed.needsYou.length > 0 ? (
        <section>
          <GroupHeader groupKey="needsYou" label={COPY.cockpitGroupNeedsYou} count={feed.needsYou.length} />
          {feed.needsYou.map((t) => <Tile key={t.id} tile={t} onAnswer={onAnswer} onOpenSheet={onOpenSheet} />)}
        </section>
      ) : null}
      {ready && feed && feed.waiting.length > 0 ? (
        <section>
          <GroupHeader groupKey="waiting" label={COPY.cockpitGroupWaiting} />
          {feed.waiting.map((t) => <Tile key={t.id} tile={t} onAnswer={onAnswer} onOpenSheet={onOpenSheet} />)}
        </section>
      ) : null}
      {monitoring ? (
        <section>
          <GroupHeader groupKey="monitoring" label={COPY.cockpitGroupMonitoring} />
          <MonitoringRow row={monitoring} onSymbolClick={onSymbolClick} />
        </section>
      ) : null}
      {ready && feed && feed.earlierTotal > 0 ? (
        <section>
          <GroupHeader groupKey="earlier" label={COPY.cockpitGroupEarlier} count={feed.earlierTotal} dim />
          {feed.earlier.map((t) => <Tile key={t.id} tile={t} onAnswer={onAnswer} onOpenSheet={onOpenSheet} />)}
          {!showAllEarlier && feed.earlierTotal > feed.earlier.length ? (
            <button
              type="button"
              data-cockpit-show-all="1"
              onClick={() => { focusAfterExpand.current = feed.earlier.length; onShowAllEarlier?.(); }}
              style={{ ...chipStyle(false), margin: '10px 12px 4px', alignSelf: 'flex-start' }}
            >
              <span style={labelSpan(12)}>{COPY.cockpitShowAll(feed.earlierTotal)}</span>
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
