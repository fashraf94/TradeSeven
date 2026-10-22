// src/screens/battleView/Cockpit2b.jsx
//
// THE V5 COCKPIT — Cockpit Build 2b, flag on (spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md §5, §6; the V5 mockup
// docs/design/COCKPIT_V5_MOCKUP.html with §1's corrections). One component for
// both shells, in place of 2a's CockpitFeed while COCKPIT_2B_ENABLED is on:
//
//   top row      the vintage (desktop, as 2a) and the commands meter (§5.1)
//   ⚡ Now        one card by the fixed priority (§5.2), or the quiet line
//   Also live    every other open card as a chip, expanding in place (§5.4)
//   day line     calls · hit · expired · answered today (§5.5), never tappable
//   Monitoring   as 2a
//   Earlier      collapsed, with its count, ten then "Show all" as 2a (§5.6)
//
// IT RENDERS THE VIEW MODEL (cockpit2bModel.js) AND KEEPS ONLY CLIENT STATE:
// the spotlight, the expanded chip, the strip's overflow, Earlier's toggle and
// the step opened by "Exit instead" (V5-4). The card held after "Confirm exit"
// (V5-6) and the replace confirmation (§6.3) live in the shared answer flow
// (useCockpit2bAnswer), because 2a's details sheet and the bench sheet answer
// too. Nothing is persisted. A spotlight or an opened step outlives nothing:
// each is dropped once its card no longer offers it (review CB4-6, CB4-10).
//
// ANSWERS go through the screen's answer hook — NO OPTIMISTIC STATE: the
// pressed button reads "Sending…", every button waits, and the card changes
// when the listener delivers the record. An override (or a pick) while a live
// call-family command stands on ANOTHER call opens the confirmation first; a
// 409 `replace_unconfirmed` (a chat directive, or a slot this client had not
// seen) opens the same prompt from the response's `currentText`.
//
// FOCUS NEVER FALLS TO <body> (2a review L5-5; 2b review CB5-2). Every
// in-place swap names where focus goes next — the expanded chip's header and
// back, the step's first live control and back to "Exit instead", the
// confirmation's Replace (focused when it appears, so it is also announced)
// and back to the pressed control on Keep, the first chip "+n more" revealed,
// the Now card after a spotlight or Done, the first row "Show all" revealed.
//
// HAZARD 48: index.css forces every <button> to 16px !important, so every
// label sizes an inner <span>. Buttons that wait are `aria-disabled`, never
// `disabled` (a pressed button keeps focus while it sends). The app has no
// global border-box: a full-width box that carries padding says so itself.
// Tokens only (`--ft-*`); `motionToken('smooth')` for card changes and chip
// expansion, `instant` under reduced motion (§9).

import React from 'react';
import { motion } from 'framer-motion';
import { cssVar } from '../../theme/cssTokens';
import { motionToken } from '../../theme/motion';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { GroupHeader, MonitoringRow, StateTag, plainButton, labelSpan, toneColor } from './CockpitFeed';
import { buildCockpit2bView, replaceLineOf, pickAnswerFor } from './cockpit2bModel';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const cssEscape = (v) => String(v).replace(/["\\]/g, '\\$&');

/** The one bullet an override carries (§6.2): a 6 px teal dot after the label. */
function Bullet() {
  return <span aria-hidden="true" data-cockpit-bullet="1" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: cssVar('teal'), marginLeft: 6, flexShrink: 0 }} />;
}

/** The chip shape the Now card's buttons share (the shipped teal-outline chip, scaled up). */
const actionStyle = (disabled, phone) => ({
  background: 'transparent',
  border: `1px solid ${cssVar('call-yours')}`,
  color: cssVar('call-yours'),
  borderRadius: 16,
  padding: '6px 12px',
  minHeight: phone ? 44 : 40,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.45 : 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
});

const eyebrowStyle = {
  fontFamily: MONO,
  fontSize: 9.5,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: cssVar('teal'),
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,
};
const subEyebrow = { color: cssVar('text-secondary'), fontWeight: 500, letterSpacing: '0.02em', textTransform: 'none' };
const monoLine = (size = 10.5, color = cssVar('text-secondary')) => ({ fontFamily: MONO, fontSize: size, color, lineHeight: 1.35 });

/**
 * The top row (the prices' vintage and the commands meter) is pinned at the top of the cockpit's scroll on both
 * shells — the pane's `data-cockpit-scroll` on desktop, the track's cockpit panel on the phone — and the group
 * headers pin just below it, so neither scrolls out of view when focus moves to the Now card after an answer.
 * Its height is fixed so the headers' offset is exact.
 */
export const COCKPIT2B_TOP_ROW_PX = 34;
const sideColor = (side) => (side === 'above' ? cssVar('pos') : side === 'below' ? cssVar('neg') : cssVar('text-secondary'));

/** The commands meter (§5.1): seven dots, filled = left, then "· {n} left" (or "No commands left"). */
function Meter({ meter }) {
  if (!meter) return null;
  return (
    <span data-cockpit-meter={meter.left} role="img" aria-label={meter.aria} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0 }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', gap: 3 }}>
        {Array.from({ length: meter.limit }, (_, i) => (
          <span
            key={i}
            data-cockpit-meter-dot={i < meter.left ? 'left' : 'spent'}
            style={{ width: 5, height: 5, borderRadius: 4, background: i < meter.left ? cssVar('teal') : 'transparent', border: `1px solid ${i < meter.left ? cssVar('teal') : cssVar('text-secondary')}` }}
          />
        ))}
      </span>
      <span aria-hidden="true" style={{ color: meter.zero ? cssVar('amber') : cssVar('text-secondary') }}>{meter.text}</span>
    </span>
  );
}

/** §6.2's buttons: agreeing first and free; every override one bullet. Shared with 2a's details sheet under the flag. */
export function CockpitActions({ buttons, phone, onPress }) {
  if (!Array.isArray(buttons) || buttons.length === 0) return null;
  return (
    <div data-cockpit-buttons="1" style={{ display: 'grid', gridTemplateColumns: `repeat(${buttons.length}, minmax(0, 1fr))`, gap: 8 }}>
      {buttons.map((b) => (
        <button
          key={b.answer}
          type="button"
          data-cockpit-answer={b.answer}
          data-cockpit-row={b.row}
          aria-label={b.aria ?? undefined}
          aria-disabled={b.disabled ? 'true' : undefined}
          onClick={() => { if (!b.disabled) onPress(b); }}
          style={actionStyle(b.disabled, phone)}
        >
          <span style={labelSpan(13)}>{b.label}</span>
          {b.dot ? <Bullet /> : null}
        </button>
      ))}
    </div>
  );
}

/** A step chip's accessible name: what it shows — picked, sending, or the pick and its cost (review CB5-10). */
function optionName(c) {
  if (c.picked) return `✓ ${c.symbol}`;
  if (c.sending) return `${c.symbol} · ${COPY.cockpit2bSending}`;
  if (c.disabled) return [c.symbol, c.note].filter(Boolean).join(' · ');
  return COPY.cockpit2bOneCommandAria(`${COPY.cockpit2bPick} ${c.symbol}`);
}

/** "Who comes in?" (§5.3): the stored options in two groups, the browse door, the foot after "Exit instead". */
function Step({ step, phone, onPick, onBrowse, onLetChoose, onCancel, onDone }) {
  if (!step) return null;
  return (
    <div data-cockpit-step={step.state} style={{ borderTop: `1px solid rgba(var(--ft-scrim-rgb), 0.08)`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: cssVar('text-primary') }}>{step.title}</span>
        {step.browse ? (
          <button type="button" data-cockpit-browse="1" onClick={onBrowse} style={{ ...plainButton, minHeight: 24, whiteSpace: 'nowrap' }}>
            <span style={{ ...labelSpan(12), color: cssVar('teal') }}>{step.browse}</span>
          </button>
        ) : null}
      </div>
      {step.groups.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: phone || step.groups.length === 1 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: phone ? 10 : 14 }}>
          {step.groups.map((g) => (
            <div key={g.key} data-cockpit-step-group={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <span style={{ ...monoLine(9.5), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.label}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {g.chips.map((c) => (
                  <button
                    key={c.symbol}
                    type="button"
                    data-cockpit-option={c.symbol}
                    data-cockpit-option-picked={c.picked ? '1' : undefined}
                    aria-disabled={c.disabled ? 'true' : undefined}
                    aria-label={optionName(c)}
                    onClick={() => { if (!c.disabled) onPick(c.symbol); }}
                    style={{
                      ...actionStyle(c.disabled && !c.picked, phone),
                      minHeight: 32,
                      padding: '4px 10px',
                      background: c.picked ? `rgba(var(--ft-teal-rgb), 0.14)` : 'transparent',
                    }}
                  >
                    <span style={labelSpan(12, 700)}>{c.picked ? `✓ ${c.symbol}` : (c.sending ? COPY.cockpit2bSending : c.symbol)}</span>
                    {c.note ? <span style={{ ...labelSpan(10.5, 500), marginLeft: 6, color: cssVar('text-secondary') }}>{c.note}</span> : null}
                    {!c.disabled ? <Bullet /> : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {step.noneLeft ? <span role="status" style={{ fontSize: 11.5, color: cssVar('amber') }}>{step.noneLeft}</span> : null}
      {step.filedLine ? <span data-cockpit-step-filed="1" style={monoLine(10.5, cssVar('call-yours'))}>{step.filedLine}</span> : null}
      {step.letChoose || step.cancel || step.done ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {step.letChoose ? (
            <button
              type="button"
              data-cockpit-let-choose="1"
              aria-label={step.letChooseDisabled ? step.letChoose : COPY.cockpit2bOneCommandAria(step.letChoose)}
              aria-disabled={step.letChooseDisabled ? 'true' : undefined}
              onClick={() => { if (!step.letChooseDisabled) onLetChoose(); }}
              style={{ ...actionStyle(step.letChooseDisabled, phone), minHeight: 36 }}
            >
              <span style={labelSpan(12)}>{step.letChoose}</span>
              {!step.letChooseDisabled ? <Bullet /> : null}
            </button>
          ) : null}
          {step.cancel ? (
            <button type="button" data-cockpit-step-cancel="1" onClick={onCancel} style={{ ...actionStyle(false, phone), minHeight: 36, borderColor: `rgba(var(--ft-scrim-rgb), 0.2)`, color: cssVar('text-secondary') }}>
              <span style={labelSpan(12)}>{step.cancel}</span>
            </button>
          ) : null}
          {step.done ? (
            <button type="button" data-cockpit-step-done="1" onClick={onDone} style={{ ...actionStyle(false, phone), minHeight: 36 }}>
              <span style={labelSpan(12)}>{step.done}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The replace confirmation (§6.3), in place, before anything is sent. Replace
 * takes focus when the prompt appears — the control that raised it is gone,
 * and focus announces the group's line (review CB5-2, CB5-4: in a scrolled
 * sheet, focus also brings the prompt into view). While the replacement is in
 * flight Replace reads "Sending…" and both wait (§6.1; review CB4-4).
 */
export function ReplaceConfirm({ line, phone, sending = false, onReplace, onKeep }) {
  const replaceRef = React.useRef(null);
  const shown = Boolean(line);
  React.useEffect(() => {
    if (shown) replaceRef.current?.focus?.();
  }, [shown]);
  if (!line) return null;
  return (
    <div data-cockpit-replace-confirm="1" role="group" aria-label={line} style={{ borderTop: `1px solid rgba(var(--ft-scrim-rgb), 0.08)`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 13.5, color: cssVar('text-primary'), lineHeight: 1.45 }}>{line}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <button
          ref={replaceRef}
          type="button"
          data-cockpit-replace="1"
          aria-label={sending ? COPY.cockpit2bSending : COPY.cockpit2bOneCommandAria(COPY.cockpit2bReplace)}
          aria-disabled={sending ? 'true' : undefined}
          onClick={() => { if (!sending) onReplace?.(); }}
          style={actionStyle(sending, phone)}
        >
          <span style={labelSpan(13)}>{sending ? COPY.cockpit2bSending : COPY.cockpit2bReplace}</span>
          {sending ? null : <Bullet />}
        </button>
        <button
          type="button"
          data-cockpit-keep="1"
          aria-disabled={sending ? 'true' : undefined}
          onClick={() => { if (!sending) onKeep?.(); }}
          style={actionStyle(sending, phone)}
        >
          <span style={labelSpan(13)}>{COPY.cockpit2bKeep}</span>
        </button>
      </div>
    </div>
  );
}

/** The moved line and the earlier levels (D-12), the marker expanding the earlier open levels. */
function MovedLine({ card }) {
  const [open, setOpen] = React.useState(false);
  if (!card.lineMoved) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {card.latestLine ? <span data-cockpit-restated="1" style={monoLine()}>{card.latestLine}</span> : null}
      <button type="button" data-cockpit-line-moved="1" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ ...plainButton, alignSelf: 'flex-start', minHeight: 24 }}>
        <span style={monoLine()}>{card.lineMoved}</span>
      </button>
      {open ? card.earlierLevels.map((l) => <span key={l.key} data-cockpit-earlier-level="1" style={monoLine(10.5)}>{l.text}</span>) : null}
    </div>
  );
}

/**
 * One card's body — the Now card and an expanded strip chip share it. The
 * eyebrow and the plan are one plain button opening 2a's details sheet. The
 * head wraps: a long tag ("Command retired · … at the {t} check") drops below
 * the eyebrow rather than pushing the card past the screen (review CB5-3, CB5-5).
 */
function CardBody({ card, phone, compact = false, confirmLine, confirmSending = false, handlers }) {
  const tags = (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: 0, flex: '0 1 auto' }}>
      {card.followTag ? <StateTag tag={card.followTag} /> : null}
      <StateTag tag={card.tag} />
    </span>
  );
  const head = (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
      <span style={{ ...eyebrowStyle, flex: '1 1 auto', color: card.mode === 'upside' ? cssVar('text-secondary') : cssVar('teal') }}>
        {card.eyebrow}
        {card.mode !== 'command' && card.from ? <span style={subEyebrow}>{' · '}{card.from}</span> : null}
      </span>
      {tags}
    </span>
  );
  const openSheet = () => handlers.onOpenSheet?.(card.tileId);
  const refusal = card.refusalLine ?? null;
  const showBody = !compact || card.mode !== 'upside';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <button
        type="button"
        data-cockpit-tile-open="1"
        aria-haspopup="dialog"
        onClick={openSheet}
        style={{ ...plainButton, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, width: '100%' }}
      >
        {head}
        {card.mode === 'upside' ? <span data-cockpit-line="1" style={{ fontSize: 14, fontWeight: 600, color: cssVar('text-primary'), lineHeight: 1.4 }}>{card.upsideLine}</span> : null}
        {card.mode === 'call' && showBody ? (
          <span data-cockpit-plan="1" style={{ fontSize: compact ? 13 : (phone ? 17 : 16.5), lineHeight: 1.4, fontWeight: compact ? 500 : 600, color: compact ? cssVar('text-secondary') : cssVar('text-primary') }}>
            {card.plan}
            {card.silence ? <span style={{ color: cssVar('text-secondary'), fontWeight: 500 }}>{' '}{card.silence}</span> : null}
          </span>
        ) : null}
        {card.mode === 'call' && card.facts ? <span data-cockpit-facts-line="1" style={monoLine()}>{card.facts}</span> : null}
        {card.mode === 'command' ? (
          <span data-cockpit-command-text="1" style={{ fontSize: compact ? 13.5 : 14.5, fontWeight: 700, color: cssVar('text-primary'), lineHeight: 1.35 }}>{card.text}</span>
        ) : null}
        {card.mode === 'command' && card.receipts?.length ? (
          <span data-cockpit-receipts-line="1" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', ...monoLine(10.5, cssVar('call-yours')) }}>
            {card.receipts.map((r, i) => (
              <React.Fragment key={`${i}-${r}`}>
                {i > 0 ? <span aria-hidden="true" style={{ color: cssVar('text-secondary') }}>→</span> : null}
                <span>{r}</span>
              </React.Fragment>
            ))}
          </span>
        ) : null}
        {card.answerLine ? <span data-cockpit-thread-answer="1" style={{ fontSize: 12, color: cssVar('call-yours') }}>{card.answerLine}</span> : null}
        {card.commandText ? <span data-cockpit-command-beside="1" style={{ fontSize: 12, color: cssVar('call-yours') }}>{card.commandText}</span> : null}
        {card.commandLine ? <span data-cockpit-command-line="1" style={{ fontSize: 12, color: cssVar('call-yours') }}>{card.commandLine}</span> : null}
      </button>
      <MovedLine card={card} />
      {confirmLine ? (
        <ReplaceConfirm line={confirmLine} phone={phone} sending={confirmSending} onReplace={handlers.onConfirmReplace} onKeep={handlers.onConfirmKeep} />
      ) : (
        <>
          {handlers.stepOpen(card) ? null : <CockpitActions buttons={card.buttons} phone={phone} onPress={(b) => handlers.onPress(card, b)} />}
          {card.step && (card.step.state !== 'after_exit_instead' || handlers.stepOpen(card)) ? (
            <Step
              step={card.step}
              phone={phone}
              onPick={(symbol) => handlers.onPick(card, symbol)}
              onBrowse={() => handlers.onBrowse(card)}
              onLetChoose={() => handlers.onLetChoose(card)}
              onCancel={() => handlers.onCancelStep(card)}
              onDone={() => handlers.onDone(card)}
            />
          ) : null}
        </>
      )}
      <div role="status" aria-live="polite" data-cockpit-refusal={refusal ? '1' : '0'} style={{ fontSize: 11.5, color: cssVar('call-dropped'), minHeight: refusal ? undefined : 0 }}>
        {refusal}
      </div>
    </div>
  );
}

/** The Now card (§5.2): the shipped tile scaled up, in the V5 teal-outlined container. */
function NowCard({ card, phone, reducedMotion, confirmLine, confirmSending, handlers }) {
  return (
    <motion.div
      data-cockpit-tile={card.tileId}
      data-cockpit-now={card.key}
      data-cockpit-card={card.key}
      data-cockpit-now-mode={card.mode}
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionToken('smooth', { reducedMotion })}
      style={{
        margin: '8px 12px 4px',
        borderRadius: 14,
        border: `1px solid rgba(var(--ft-teal-rgb), 0.3)`,
        background: `rgba(var(--ft-shadow-rgb), 0.35)`,
        boxShadow: `0 0 28px rgba(var(--ft-teal-rgb), 0.07)`,
        padding: '12px 14px 14px',
        minWidth: 0,
      }}
    >
      <CardBody card={card} phone={phone} confirmLine={confirmLine} confirmSending={confirmSending} handlers={handlers} />
    </motion.div>
  );
}

/** One Also-live chip (§5.4): compact, or expanded in place to the card anatomy with "Spotlight →". */
function StripChip({ chip, phone, reducedMotion, confirmLine, confirmSending, handlers }) {
  const dot = (
    <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: chip.yours ? cssVar('teal') : cssVar('text-secondary'), flexShrink: 0 }} />
  );
  const [sym, ...rest] = chip.text.split(' ');
  const label = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, flexWrap: 'wrap', ...monoLine(10.5) }}>
      {dot}
      <span style={{ color: cssVar('text-primary'), fontWeight: 700 }}>{sym}</span>
      <span style={{ color: sideColor(chip.side) }}>{rest[0]}</span>
      <span style={{ color: chip.yours ? cssVar('call-yours') : cssVar('text-secondary') }}>{rest.slice(1).join(' ')}</span>
    </span>
  );
  if (!chip.card) {
    return (
      <button
        type="button"
        data-cockpit-chip={chip.key}
        data-cockpit-chip-toggle="1"
        aria-expanded="false"
        aria-label={chip.aria}
        onClick={() => handlers.onExpand(chip.key)}
        style={{
          ...plainButton,
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          minHeight: 26,
          maxWidth: '100%',
          borderRadius: 13,
          border: `1px solid ${chip.yours ? `rgba(var(--ft-teal-rgb), 0.5)` : `rgba(var(--ft-scrim-rgb), 0.14)`}`,
          background: chip.yours ? `rgba(var(--ft-teal-rgb), 0.08)` : `rgba(var(--ft-shadow-rgb), 0.25)`,
        }}
      >
        {label}
      </button>
    );
  }
  return (
    <motion.div
      data-cockpit-chip={chip.key}
      data-cockpit-card={chip.key}
      data-cockpit-tile={chip.card.tileId}
      data-cockpit-chip-expanded="1"
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={motionToken('smooth', { reducedMotion })}
      style={{
        // A flex item in the wrapping strip: its min-content must not be its text's width (review CB5-3), and its
        // padding counts inside the 100% (no global border-box here).
        flexBasis: '100%',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        borderRadius: 12,
        border: `1px solid ${chip.yours ? `rgba(var(--ft-teal-rgb), 0.4)` : `rgba(var(--ft-scrim-rgb), 0.14)`}`,
        background: `rgba(var(--ft-shadow-rgb), 0.3)`,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <button
        type="button"
        data-cockpit-chip-toggle="1"
        aria-expanded="true"
        aria-label={COPY.cockpit2bChipAriaCollapse(chip.text)}
        onClick={() => handlers.onExpand(chip.key)}
        style={{ ...plainButton, minHeight: 26, display: 'flex', alignItems: 'center', minWidth: 0 }}
      >
        {label}
      </button>
      <CardBody card={chip.card} phone={phone} compact confirmLine={confirmLine} confirmSending={confirmSending} handlers={handlers} />
      {chip.spotlight ? (
        <button type="button" data-cockpit-spotlight={chip.key} onClick={() => handlers.onSpotlight(chip.key)} style={{ ...plainButton, alignSelf: 'flex-start', minHeight: 24 }}>
          <span style={{ ...labelSpan(10.5), fontFamily: MONO, color: cssVar('teal') }}>{COPY.cockpit2bSpotlight}</span>
        </button>
      ) : null}
    </motion.div>
  );
}

/**
 * @param {object} props
 * @param {object} props.feed          buildCockpitFeed({ ..., v2: true })
 * @param {'loading'|'ready'|'error'} [props.status]
 * @param {object} props.records       { calls, events, rawExchanges, battle, evaluations, controlEpochLog, suppressed }
 * @param {string} props.agent
 * @param {number} props.nowMs         the SERVER's now
 * @param {boolean} props.phone
 * @param {string|null} props.vintage  desktop only (as 2a)
 * @param {boolean} props.league
 * @param {object|null} props.pending  the answer hook's in-flight answer
 * @param {object} props.flow          useCockpit2bAnswer(...) — the confirmation and the held card, shared with the sheets
 * @param {(target: { callId: string, step: string|null, cardKey: string }) => void} props.onOpenBench
 * @param {() => void} [props.onShowAllEarlier]  2a's "Show all" (the screen holds the flag the feed reads)
 */
export default function Cockpit2b({
  feed,
  status = 'ready',
  records,
  agent = 'Your Agent',
  nowMs,
  phone = false,
  vintage = null,
  league = false,
  nextDecisionAt = null,
  monitoring = null,
  pending = null,
  reducedMotion = false,
  flow,
  onOpenSheet,
  onSymbolClick,
  onOpenBench,
  onShowAllEarlier = null,
}) {
  const rootRef = React.useRef(null);
  const [spotlightKey, setSpotlightKey] = React.useState(null);
  const [expandedKey, setExpandedKey] = React.useState(null);
  const [overflow, setOverflow] = React.useState(false);
  const [earlierOpen, setEarlierOpen] = React.useState(false);
  const [stepOpenKey, setStepOpenKey] = React.useState(null);
  // Where focus goes after the next render: a function of the root, run once (review CB5-2).
  const [focusAfter, setFocusAfter] = React.useState(null);
  const { calls = [], events = [], rawExchanges = [], battle = null, evaluations = [], controlEpochLog = null, suppressed = false } = records || {};
  const heldKey = flow?.heldKey ?? null;
  const confirm = flow?.confirm ?? null;

  const view = React.useMemo(() => (feed ? buildCockpit2bView({
    feed, calls, events, rawExchanges, battle, agent, nowMs, phone, evaluations, nextDecisionAt, league, controlEpochLog, suppressed,
    ui: { spotlightKey, heldKey, expandedKey, overflow, pending, stepOpenKey },
  }) : null), [feed, calls, events, rawExchanges, battle, agent, nowMs, phone, evaluations, nextDecisionAt, league, controlEpochLog, suppressed, spotlightKey, heldKey, expandedKey, overflow, pending, stepOpenKey]);

  // A held card ends once it no longer leads (picked, resolved, or its step gone); a confirmation
  // whose card left this screen is dropped; a spotlight or an opened step its card no longer offers is dropped.
  const nowKey = view?.nowKey ?? null;
  const shownKeys = view ? [view.nowKey, ...view.strip.chips.filter((c) => c.card).map((c) => c.key)].filter(Boolean).join('|') : '';
  const release = flow?.release;
  const keep = flow?.keep;
  const spotlightStale = Boolean(view?.spotlightStale);
  const stepOpenStale = Boolean(view?.stepOpenStale);
  React.useEffect(() => {
    if (heldKey && nowKey !== heldKey) release?.();
  }, [heldKey, nowKey, release]);
  React.useEffect(() => {
    if (confirm && confirm.surface === 'card' && !shownKeys.split('|').includes(confirm.key)) keep?.();
  }, [confirm, shownKeys, keep]);
  React.useEffect(() => { if (spotlightStale) setSpotlightKey(null); }, [spotlightStale]);
  React.useEffect(() => { if (stepOpenStale) setStepOpenKey(null); }, [stepOpenStale]);
  React.useLayoutEffect(() => {
    if (!focusAfter) return;
    const el = rootRef.current ? focusAfter(rootRef.current) : null;
    if (el && typeof el.focus === 'function') el.focus();
    setFocusAfter(null);
  }, [focusAfter]);

  if (!view) return null;
  const ready = status === 'ready';
  const card = (key) => `[data-cockpit-card="${cssEscape(key)}"]`;
  const focusNext = (fn) => setFocusAfter(() => fn);
  const nowOpen = (root) => root.querySelector('[data-cockpit-now] [data-cockpit-tile-open]');
  const target = (c) => ({ surface: 'card', key: c.key, step: c.step?.state ?? null });
  const afterFiling = (result) => { if (result?.status === 200) setStepOpenKey(null); };
  const handlers = {
    onOpenSheet,
    stepOpen: (c) => Boolean(c.step) && stepOpenKey === c.step.callId && c.step.state === 'after_exit_instead',
    onPress: (c, b) => {
      if (b.opensStep) {
        setStepOpenKey(c.step?.callId ?? null);
        focusNext((root) => root.querySelector(`${card(c.key)} [data-cockpit-step] button:not([aria-disabled="true"])`));
        return;
      }
      flow?.request(target(c), b.callId, b.answer, { override: b.row === 'directive' });
    },
    onPick: (c, symbol) => {
      const answer = pickAnswerFor(c.step?.state);
      if (answer) Promise.resolve(flow?.request(target(c), c.step.callId, answer, { pickSymbol: symbol, override: true })).then(afterFiling);
    },
    onLetChoose: (c) => { Promise.resolve(flow?.request(target(c), c.step.callId, 'go_now', { override: true })).then(afterFiling); },
    onCancelStep: (c) => {
      setStepOpenKey(null);
      focusNext((root) => root.querySelector(`${card(c.key)} [data-cockpit-answer="go_now"]`));
    },
    onDone: () => { flow?.release(); focusNext(nowOpen); },
    onBrowse: (c) => onOpenBench?.({ callId: c.step?.callId ?? c.callId, step: c.step?.state ?? null, cardKey: c.key }),
    onConfirmReplace: () => flow?.replace(),
    onConfirmKeep: () => {
      const was = confirm;
      flow?.keep();
      if (!was) return;
      focusNext((root) => {
        const scope = root.querySelector(card(was.key));
        if (!scope) return null;
        const pressed = was.pickSymbol
          ? scope.querySelector(`[data-cockpit-option="${cssEscape(was.pickSymbol)}"]`) ?? scope.querySelector('[data-cockpit-let-choose]')
          : scope.querySelector(`[data-cockpit-answer="${cssEscape(was.answer)}"]`) ?? scope.querySelector('[data-cockpit-let-choose]');
        return pressed ?? scope.querySelector('[data-cockpit-tile-open]');
      });
    },
    onExpand: (key) => {
      setExpandedKey((k) => (k === key ? null : key));
      focusNext((root) => root.querySelector(`[data-cockpit-chip="${cssEscape(key)}"][data-cockpit-chip-toggle], [data-cockpit-chip="${cssEscape(key)}"] [data-cockpit-chip-toggle]`));
    },
    onSpotlight: (key) => { setSpotlightKey(key); setExpandedKey(null); focusNext(nowOpen); },
  };
  const confirmFor = (key) => (confirm && confirm.surface === 'card' && confirm.key === key ? confirm : null);
  const confirmLineFor = (key) => {
    const c = confirmFor(key);
    return c ? replaceLineOf({ kind: c.kind, symbol: c.symbol, text: c.text, agent }) : null;
  };
  const confirmSendingFor = (key) => {
    const c = confirmFor(key);
    return Boolean(c) && Boolean(pending) && pending.callId === c.callId;
  };
  const shownChips = view.strip.chips.length;

  return (
    <div ref={rootRef} data-cockpit-feed="2b" data-cockpit-status={status} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <div
        data-cockpit-top-row="1"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 3,
          height: COCKPIT2B_TOP_ROW_PX,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '0 14px',
          borderBottom: `1px solid rgba(var(--ft-scrim-rgb), 0.07)`,
          background: `rgba(var(--ft-shadow-rgb), 0.92)`,
          backdropFilter: 'blur(8px)',
          ...monoLine(10.5),
        }}
      >
        <span data-cockpit-vintage="1" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vintage}</span>
        <Meter meter={view.meter} />
      </div>
      {status === 'error' ? (
        <div data-cockpit-read-error="1" style={{ padding: '18px 14px', fontSize: 13, color: cssVar('text-secondary'), lineHeight: 1.45 }}>{COPY.cockpitReadError}</div>
      ) : null}
      {ready ? (
        <>
          <section data-cockpit-now-section="1">
            <GroupHeader groupKey="now" label={COPY.cockpit2bNowHeader} count={view.nowCount} stickyTop={COCKPIT2B_TOP_ROW_PX} />
            {view.now ? (
              <NowCard key={`${view.now.key}:${view.now.mode}`} card={view.now} phone={phone} reducedMotion={reducedMotion} confirmLine={confirmLineFor(view.now.key)} confirmSending={confirmSendingFor(view.now.key)} handlers={handlers} />
            ) : (
              <div data-cockpit-quiet="1" style={{ padding: '18px 14px 8px', fontSize: 13, color: cssVar('text-secondary'), lineHeight: 1.45, display: 'flex', alignItems: 'center', gap: 9 }}>
                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: cssVar('teal'), flexShrink: 0 }} />
                {view.quietLine}
              </div>
            )}
          </section>
          {view.strip.count > 0 ? (
            <section data-cockpit-strip="1" style={{ padding: '10px 12px 6px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <span role="heading" aria-level={3} style={eyebrowStyle}>{view.strip.header}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
                {view.strip.chips.map((chip) => (
                  <StripChip key={chip.key} chip={chip} phone={phone} reducedMotion={reducedMotion} confirmLine={confirmLineFor(chip.key)} confirmSending={confirmSendingFor(chip.key)} handlers={handlers} />
                ))}
                {view.strip.more ? (
                  <button
                    type="button"
                    data-cockpit-strip-more="1"
                    onClick={() => {
                      setOverflow(true);
                      focusNext((root) => root.querySelectorAll('[data-cockpit-strip] [data-cockpit-chip-toggle]')[shownChips] ?? null);
                    }}
                    style={{ ...plainButton, padding: '4px 10px', minHeight: 26, borderRadius: 13, border: `1px solid rgba(var(--ft-scrim-rgb), 0.14)` }}
                  >
                    <span style={monoLine(10.5, cssVar('text-primary'))}>{view.strip.more}</span>
                  </button>
                ) : null}
                {view.strip.fewer ? (
                  <button
                    type="button"
                    data-cockpit-strip-fewer="1"
                    onClick={() => { setOverflow(false); focusNext((root) => root.querySelector('[data-cockpit-strip-more]')); }}
                    style={{ ...plainButton, padding: '4px 6px', minHeight: 26 }}
                  >
                    <span style={monoLine(10.5)}>{view.strip.fewer}</span>
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}
          <div data-cockpit-day-line="1" style={{ padding: '6px 12px 4px', ...monoLine(10.5) }}>{view.dayLine}</div>
        </>
      ) : null}
      {monitoring ? (
        <section>
          <GroupHeader groupKey="monitoring" label={COPY.cockpitGroupMonitoring} stickyTop={COCKPIT2B_TOP_ROW_PX} />
          <MonitoringRow row={monitoring} onSymbolClick={onSymbolClick} />
        </section>
      ) : null}
      {ready && view.earlier.count > 0 ? (
        <section data-cockpit-earlier="1">
          <div role="heading" aria-level={3} data-cockpit-group="earlier" style={{ padding: '10px 12px 6px', background: `linear-gradient(90deg, rgba(var(--ft-teal-rgb), 0.04), rgba(var(--ft-shadow-rgb), 0.85) 55%)` }}>
            <button
              type="button"
              data-cockpit-earlier-toggle="1"
              aria-expanded={earlierOpen}
              onClick={() => setEarlierOpen((v) => !v)}
              style={{ ...plainButton, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 24 }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: cssVar('text-secondary'), lineHeight: 1.2 }}>{COPY.cockpitGroupEarlier}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: cssVar('text-secondary'), background: `rgba(var(--ft-teal-rgb), 0.05)`, padding: '2px 8px', borderRadius: 6, letterSpacing: '0.04em', lineHeight: 1.2 }}>{view.earlier.count}</span>
            </button>
          </div>
          {earlierOpen ? view.earlier.rows.map((r) => (
            <div key={r.key} data-cockpit-tile={r.tileId} data-cockpit-earlier-row="1" style={{ borderBottom: `1px solid rgba(var(--ft-scrim-rgb), 0.07)` }}>
              <button
                type="button"
                data-cockpit-tile-open="1"
                aria-haspopup="dialog"
                onClick={() => onOpenSheet?.(r.tileId)}
                style={{ ...plainButton, display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px' }}
              >
                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: toneColor(r.tone), flexShrink: 0 }} />
                <span style={monoLine(11)}>{r.text}</span>
              </button>
            </div>
          )) : null}
          {earlierOpen && view.earlier.more && typeof onShowAllEarlier === 'function' ? (
            <button
              type="button"
              data-cockpit-show-all="1"
              onClick={() => {
                const shown = view.earlier.rows.length;
                onShowAllEarlier();
                focusNext((root) => root.querySelectorAll('[data-cockpit-earlier-row] [data-cockpit-tile-open]')[shown] ?? null);
              }}
              style={{ ...plainButton, margin: '10px 12px 4px', padding: '6px 12px', minHeight: 36, borderRadius: 16, border: `1px solid ${cssVar('call-yours')}`, color: cssVar('call-yours') }}
            >
              <span style={labelSpan(12)}>{view.earlier.more}</span>
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
