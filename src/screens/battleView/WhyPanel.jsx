// src/screens/battleView/WhyPanel.jsx
//
// Why? — the panel a piece opens (Phase A, A2). A PURE READ (C1): everything
// here is text the decision path persisted or a scoring fact the row already
// renders. No fetch, no model call, no attribution copy (hazard 5), no lock
// line (hazards 6, 16), nothing derived twice (hazard 15).
//
// Content order (seed §A2), row-level:
//   1. This piece today — the symbol's trades from trades[], engine text.
//   2. At the {t} check — the agent's own words from the latest decision, the
//      downgraded branch first (selectWhyState.js), the tapped symbol
//      emphasised where it appears. Absence is a truthful state.
//   3. Facts — the row's proximity text (passed in), entry, held since.
//   4. One door: Ask a follow-up · 1 message → the composer, prefilled.
// Book-level (the score header): 2 → This turn (A3) → the door. No facts.
//
// Every string comes from battleViewCopy.js; the panel types no prose.
// Colours via the token bridge; motion via the vocabulary, reduced-motion
// aware; the expansion is the only motion and it plays once per open.

import React from 'react';
import { motion } from 'framer-motion';
import { cssVar } from '../../theme/cssTokens';
import { motionToken } from '../../theme/motion';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { WHY_KIND, emphasizeSymbol } from './selectWhyState';

const LABEL_COLOR = {
  [WHY_KIND.DOWNGRADED]: cssVar('amber'),
  [WHY_KIND.SWAPPED]: cssVar('teal'),
  [WHY_KIND.HELD]: cssVar('text-secondary'),
  [WHY_KIND.ABSENT]: cssVar('text-muted'),
};

const eyebrow = {
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: cssVar('text-muted'),
};

const mono = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontVariantNumeric: 'tabular-nums',
};

function Rationale({ text, symbol }) {
  if (!text) return null;
  const segments = emphasizeSymbol(text, symbol);
  return (
    <p style={{
      margin: 0,
      fontSize: 13,
      lineHeight: 1.5,
      color: cssVar('text-primary'),
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {segments.map((seg, i) => (seg.emphasized
        ? <strong key={i} style={{ color: cssVar('teal'), fontWeight: 700 }}>{seg.text}</strong>
        : <React.Fragment key={i}>{seg.text}</React.Fragment>))}
    </p>
  );
}

export default function WhyPanel({
  symbol = null,
  state,
  proximity = null,
  entryPrice = null,
  heldSince = null,
  trades = [],
  thisTurn = null,
  onAskFollowUp,
  reducedMotion = false,
  headingId,
}) {
  if (!state) return null;
  const isBook = symbol == null;
  const transition = motionToken('smooth', { reducedMotion: Boolean(reducedMotion) });
  const facts = isBook ? [] : [
    proximity?.text ?? null,
    COPY.factEntry(entryPrice),
    COPY.factHeldSince(heldSince),
  ].filter(Boolean);
  const id = headingId || `why-${isBook ? 'book' : symbol}-heading`;

  return (
    <motion.section
      role="region"
      {...(state.header ? { 'aria-labelledby': id } : { 'aria-label': state.label })}
      data-why-kind={state.kind}
      data-why-symbol={isBook ? 'book' : symbol}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={transition}
      style={{ overflow: 'hidden' }}
    >
      <div style={{
        margin: '0 12px 10px',
        padding: '12px 14px',
        borderRadius: 10,
        background: cssVar('bg-card'),
        borderLeft: `2px solid ${cssVar('teal')}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {/* 1. This piece today — omitted when there is nothing to show */}
        {!isBook && trades.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={eyebrow}>{COPY.thisPieceToday}</div>
            {trades.map((t, i) => (
              <div key={`${t.at || 'trade'}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ ...mono, fontSize: 11.5, color: cssVar('text-secondary') }}>
                  {COPY.tradeLine(t.at, t.symbolOut, t.symbolIn)}
                </div>
                <Rationale text={t.rationale} symbol={symbol} />
              </div>
            ))}
          </div>
        )}

        {/* 2. At the last decision — header names the CHECK, never the piece */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {state.header && <div id={id} style={eyebrow}>{state.header}</div>}
          <div style={{ fontSize: 12.5, fontWeight: 700, color: LABEL_COLOR[state.kind] || cssVar('text-secondary') }}>
            {state.label}
          </div>
          <Rationale text={state.rationale} symbol={symbol} />
          {state.footer && (
            <div style={{ fontSize: 10.5, color: cssVar('text-muted'), letterSpacing: '0.02em' }}>
              {state.footer}
            </div>
          )}
        </div>

        {/* 3. Facts — the row's own numbers, passed in. No lock line. */}
        {facts.length > 0 && (
          <div style={{ ...mono, fontSize: 11.5, color: cssVar('text-secondary') }}>
            {facts.join(' · ')}
          </div>
        )}

        {/* Book-level: This turn (A3) sits between the decision and the door */}
        {isBook && thisTurn}

        {/* 4. The one door */}
        {typeof onAskFollowUp === 'function' && (
          <div>
            <button
              type="button"
              onClick={() => onAskFollowUp(isBook ? null : symbol)}
              style={{
                background: 'transparent',
                border: `1px solid ${cssVar('teal')}`,
                color: cssVar('teal'),
                borderRadius: 16,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {COPY.askFollowUp}
            </button>
          </div>
        )}
      </div>
    </motion.section>
  );
}
