// src/screens/battleView/TapeCards.jsx
//
// The tape's two cards and its one collapsed line — Phase A2 (A2.2, D-72).
//
// Each renders ONE entry built by buildTape.js and nothing else: no fetch, no
// join, no derivation. Everything they show is either a persisted fact or a
// string from battleViewCopy.js — the components type no prose.
//
// AN ENGINE RECORD IS NOT SPEECH (D-84). The tape carries four unmistakable
// kinds in one stream, and these components are the third of them:
//
//   1. character speech      the shipped left bubble — a fill, a 3px accent
//                            edge, and a TAIL (the square top-left corner)
//   2. the player's messages the shipped right bubble — a fill and a tail at
//                            the bottom-right
//   3. ENGINE RECORDS        this file. FLAT: no fill, no radius, no tail. A
//                            2px left edge from a token, a mono eyebrow, and
//                            the first sentence with `Read more`.
//   4. directive cards       the shipped ExecutionCard under its `Directive`
//                            eyebrow (AgentChat.jsx)
//
// Before D-84 a record wore a filled, rounded card — the bubble's own visual
// language — so the machine's ledger read as another voice in the
// conversation. Nothing a record shows is speech: a swap is a receipt and a
// check is a log line. Flat and edged is what says so without a word of copy.
//
// WHAT A TRADE CARD MUST NEVER SHOW (hazard 29, D-64): `pvpContext`,
// `hypothesis` (a forecast — honesty rule 2), `conviction`,
// `trade_reasoning.indicators`, `citedRules`, `regime`, `exitReason` (a
// machinery-provenance code, review F10), `source`, `triggeredBy`. None of
// them is on the entry the builder produces, so none can reach here.
//
// The one provenance code that used to reach the screen anyway did so INSIDE
// the engine's own verbatim sentence — `Guardrail override (guardrail_stopLoss):
// …` — where C1 and hazard 29 met and only a ruling could separate them (A2
// review L5-F3). D-80 ruled it: the guardrail type renders in the words it is
// called by, or the parenthetical goes. The translation happens once, in
// `renderMotive`, before the entry is built, so every surface that shows a
// motive shows the same sentence (BUILD_RULES §9).
//
// Colours via the token bridge; motion via the vocabulary, reduced-motion
// aware. `Read more` is local state — one card's expansion is not a fact
// about the battle and never leaves the component.

import React, { useState } from 'react';
import { cssVar } from '../../theme/cssTokens';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { WHY_KIND } from './selectWhyState';

const LABEL_COLOR = {
  [WHY_KIND.DOWNGRADED]: cssVar('amber'),
  [WHY_KIND.FAILED]: cssVar('amber'),
  [WHY_KIND.GUARDRAIL_FAILED]: cssVar('amber'),
  [WHY_KIND.SWAPPED]: cssVar('teal'),
  [WHY_KIND.HELD]: cssVar('text-secondary'),
  [WHY_KIND.ABSENT]: cssVar('text-muted'),
};

const mono = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontVariantNumeric: 'tabular-nums',
};

/**
 * THE RECORD SHELL (D-84). Flat — no fill and no radius, so it cannot be
 * mistaken for either bubble — with one 2px edge in the colour of what the
 * record is about, and the full column width (a bubble stops at 85%, which is
 * itself part of how a bubble reads).
 *
 * `edge` is always a `cssVar` value from the caller: the token bridge is the
 * only colour source in this file (BUILD_RULES §10), and no hex is authored
 * here or anywhere in the directory.
 */
const record = (edge) => ({
  margin: '10px 10px',
  padding: '2px 0 2px 10px',
  background: 'transparent',
  borderRadius: 0,
  borderLeft: `2px solid ${edge}`,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
});

/**
 * The eyebrow of a record: MONO, because it is a machine's own line — a
 * timestamp, a pair, a tier, a state — and every character of it came off the
 * document. The bubbles' eyebrows are the agent's name and its message type,
 * set in the body face; these never are.
 */
const eyebrow = {
  ...mono,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.02em',
};

const footnote = {
  fontSize: 10.5,
  color: cssVar('text-muted'),
  letterSpacing: '0.02em',
};

const body = {
  margin: 0,
  fontSize: 12.5,
  lineHeight: 1.5,
  color: cssVar('text-secondary'),
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const linkButton = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  color: cssVar('teal'),
  fontSize: 11.5,
  fontWeight: 600,
  textAlign: 'left',
  textDecoration: 'underline',
  cursor: 'pointer',
};

/**
 * A record's prose: the first sentence, then `Read more` for the rest (D-84).
 * ONE component for both cards, so a trade card and a check card cannot
 * disagree about what "collapsed" means — the drift that FIX-3 fixed in the
 * builder, kept out of the components by construction.
 *
 * Both sides trimmed (review L2-F4): a rationale ending in a space or a
 * newline — which model prose routinely does — differed from its own only
 * sentence, so a one-sentence record showed a `Read more` that revealed
 * nothing but its own disappearance.
 */
function RecordProse({ text, firstSentence, startExpanded = false }) {
  const [expanded, setExpanded] = useState(Boolean(startExpanded));
  const full = typeof text === 'string' ? text.trim() : '';
  if (!full) return null;
  const opening = firstSentence || full;
  const hasMore = full !== opening;
  return (
    <>
      <p style={body}>{expanded ? full : opening}</p>
      {hasMore && !expanded && (
        <div>
          <button type="button" style={linkButton} onClick={() => setExpanded(true)}>{COPY.readMore}</button>
        </div>
      )}
    </>
  );
}

/**
 * An executed swap: when, the pair, the tier, what was banked, the motive —
 * and whose words the motive is.
 */
export function TradeCard({ entry }) {
  if (!entry) return null;
  const banked = COPY.banked(entry.lockedPoints);
  return (
    <div data-tape-kind="trade" data-tape-pair={`${entry.symbolOut ?? ''}-${entry.symbolIn ?? ''}`} style={record(cssVar('teal'))}>
      {entry.fromDirective && <div style={{ ...footnote, color: cssVar('teal') }}>{COPY.fromDirective}</div>}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ ...eyebrow, color: cssVar('teal') }}>
          {COPY.tradeCardLine(entry.at, entry.symbolOut, entry.symbolIn, entry.tier)}
        </div>
        {banked && <div style={{ ...mono, fontSize: 11.5, color: cssVar('text-secondary') }}>{banked}</div>}
      </div>
      <RecordProse text={entry.motive} firstSentence={entry.motiveFirstSentence} />
      {entry.motive && (
        <div style={footnote}>{entry.motiveIsAgent ? COPY.motiveAgent : COPY.motiveSystem}</div>
      )}
    </div>
  );
}

/**
 * A decided check: the tick's label, why it ran, and the first sentence of its
 * words — `Read more` opens the rest in place. The label is the Why? panel's,
 * so the two surfaces cannot describe one tick differently.
 */
export function CheckCard({ entry, startExpanded = false }) {
  if (!entry) return null;
  const wokenBy = COPY.wokenBy(entry.triggers);
  const edge = LABEL_COLOR[entry.kind] || cssVar('text-secondary');
  return (
    <div
      data-tape-kind="check"
      data-tape-check-kind={entry.kind}
      // D-89 — the address `Read the full check` asks for, and the focus stop
      // it lands on. `tabIndex={-1}` makes the card programmatically focusable
      // without putting every card in the tab order: a reader arrives here by
      // asking to, never by tabbing past thirty of them.
      data-tape-entry-id={entry.id}
      tabIndex={-1}
      style={record(edge)}
    >
      <div style={{ ...eyebrow, color: edge }}>
        {COPY.checkCardLabel(entry.at, entry.label)}
      </div>
      {wokenBy && <div style={footnote}>{wokenBy}</div>}
      <RecordProse text={entry.rationale} firstSentence={entry.firstSentence} startExpanded={startExpanded} />
      {entry.footer && entry.rationale && <div style={footnote}>{entry.footer}</div>}
    </div>
  );
}

/**
 * A run of checks that changed nothing a player can see. One line, not n
 * cards: a fullday battle runs up to 27 checks and most of them hold.
 *
 * The quietest member of the record family — the same left edge and the same
 * mono face, with nothing but the count.
 */
export function CheckRunLine({ entry }) {
  if (!entry) return null;
  return (
    <div
      data-tape-kind="checkRun"
      data-tape-run-count={entry.count}
      style={{ ...record(cssVar('text-muted')), ...mono, ...footnote, gap: 0 }}
    >
      {COPY.checksNoChange(entry.count)}
    </div>
  );
}

export default TradeCard;
