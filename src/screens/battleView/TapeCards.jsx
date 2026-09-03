// src/screens/battleView/TapeCards.jsx
//
// The tape's two cards and its one collapsed line — Phase A2 (A2.2, D-72).
//
// Each renders ONE entry built by buildTape.js and nothing else: no fetch, no
// join, no derivation. Everything they show is either a persisted fact or a
// string from battleViewCopy.js — the components type no prose.
//
// WHAT A TRADE CARD MUST NEVER SHOW (hazard 29, D-64): `pvpContext`,
// `hypothesis` (a forecast — honesty rule 2), `conviction`,
// `trade_reasoning.indicators`, `citedRules`, `regime`, `exitReason` (a
// machinery-provenance code, review F10), `source`, `triggeredBy`. None of
// them is on the entry the builder produces, so none can reach here.
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

const card = {
  margin: '6px 10px',
  padding: '10px 12px',
  borderRadius: 10,
  background: cssVar('bg-card'),
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
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
  color: cssVar('text-primary'),
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
 * An executed swap: when, the pair, the tier, what was banked, the motive —
 * and whose words the motive is.
 */
export function TradeCard({ entry }) {
  if (!entry) return null;
  const banked = COPY.banked(entry.lockedPoints);
  return (
    <div data-tape-kind="trade" data-tape-pair={`${entry.symbolOut ?? ''}-${entry.symbolIn ?? ''}`} style={{ ...card, borderLeft: `2px solid ${cssVar('teal')}` }}>
      {entry.fromDirective && <div style={{ ...footnote, color: cssVar('teal') }}>{COPY.fromDirective}</div>}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: cssVar('text-primary') }}>
          {COPY.tradeCardLine(entry.at, entry.symbolOut, entry.symbolIn, entry.tier)}
        </div>
        {banked && <div style={{ ...mono, fontSize: 11.5, color: cssVar('text-secondary') }}>{banked}</div>}
      </div>
      {entry.motive && <p style={body}>{entry.motive}</p>}
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
export function CheckCard({ entry }) {
  const [expanded, setExpanded] = useState(false);
  if (!entry) return null;
  const wokenBy = COPY.wokenBy(entry.triggers);
  const hasMore = Boolean(entry.rationale) && entry.rationale !== entry.firstSentence;
  const text = expanded ? entry.rationale : entry.firstSentence;
  return (
    <div data-tape-kind="check" data-tape-check-kind={entry.kind} style={card}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: LABEL_COLOR[entry.kind] || cssVar('text-secondary') }}>
        {COPY.checkCardLabel(entry.at, entry.label)}
      </div>
      {wokenBy && <div style={footnote}>{wokenBy}</div>}
      {text && <p style={body}>{text}</p>}
      {hasMore && !expanded && (
        <div>
          <button type="button" style={linkButton} onClick={() => setExpanded(true)}>{COPY.readMore}</button>
        </div>
      )}
    </div>
  );
}

/**
 * A run of checks that changed nothing a player can see. One line, not n
 * cards: a fullday battle runs up to 27 checks and most of them hold.
 */
export function CheckRunLine({ entry }) {
  if (!entry) return null;
  return (
    <div
      data-tape-kind="checkRun"
      data-tape-run-count={entry.count}
      style={{ ...mono, ...footnote, margin: '6px 10px', padding: '2px 2px' }}
    >
      {COPY.checksNoChange(entry.count)}
    </div>
  );
}

export default TradeCard;
