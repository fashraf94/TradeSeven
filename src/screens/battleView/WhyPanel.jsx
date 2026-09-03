// src/screens/battleView/WhyPanel.jsx
//
// Why? — the panel a piece opens (Phase A, A2). A PURE READ (C1): everything
// here is text the decision path persisted or a scoring fact the row already
// renders. No fetch, no model call, no attribution copy (hazard 5), no lock
// line (hazards 6, 16), nothing derived twice (hazard 15).
//
// Content order (A2.1, D-75), row-level:
//   1. The piece's lines — `Bagger $ · Bust $`, the two SCORING tiers as
//      prices, computed by the caller from two persisted values and footed
//      `from the scoring path`. No stop line (D-79) and no alert line (D-78).
//   2. This piece today — the symbol's trades from trades[], engine text.
//   3. From the {t} check — the state label, why the tick ran, and the
//      sentences of the check's rationale that NAME this piece, verbatim
//      (extractSentences). `Not named at the {t} check` when the check spoke
//      and none of it was about this piece. `Read the full check` opens the
//      book panel, which is where the whole paragraph lives.
//   4. Facts — the row's proximity text (passed in), entry, held since.
//   5. One door: Ask a follow-up · 1 message → the composer, prefilled.
// Book-level (the score header): 3 with the FULL rationale → the door. No
// lines, no facts. This turn has ONE home — the strip above the board (A4);
// the panel carries no second copy.
//
// THE FULL PARAGRAPH NEVER RENDERS ON A ROW (D-75). Before A2 every one of the
// seven rows showed the same block of text — one paragraph about the book,
// claimed seven times as a paragraph about a piece.
//
// Every string comes from battleViewCopy.js; the panel types no prose.
// Colours via the token bridge; motion via the vocabulary, reduced-motion
// aware; the expansion is the only motion and it plays once per open.

import React from 'react';
import { motion } from 'framer-motion';
import { cssVar } from '../../theme/cssTokens';
import { motionToken } from '../../theme/motion';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { WHY_KIND, emphasizeSymbol, extractSentences } from './selectWhyState';

const LABEL_COLOR = {
  [WHY_KIND.DOWNGRADED]: cssVar('amber'),
  [WHY_KIND.FAILED]: cssVar('amber'),
  // The fifth state (A2.0, D-70) is the same class of outcome as the fourth —
  // a swap that did not go through — so it wears the same colour; only the
  // subject of the sentence differs (the guardrail, not the agent).
  [WHY_KIND.GUARDRAIL_FAILED]: cssVar('amber'),
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
  lines = null,
  trades = [],
  onAskFollowUp,
  onReadFullCheck = null,
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

  // The row's eyebrow says the sentences came FROM the check; the book panel's
  // says the panel IS the check. One string each, one time each.
  const decisionHeading = isBook ? state.header : COPY.fromCheck(state.checkedAt);
  const id = headingId || `why-${isBook ? 'book' : symbol}-heading`;

  // The tier lines and the `from the scoring path` footer render together or
  // not at all: the caller returns null rather than an estimate.
  const tierLine = lines ? COPY.tierPrices(lines.bagger, lines.bust) : null;

  // Why this tick ran (D-78) — from the persisted trigger TYPES only; an
  // unruled type renders nothing at all rather than a raw string.
  const wokenBy = COPY.wokenBy(state.triggers);

  // The row shows only the sentences that name this piece. Two empty cases,
  // and they are different states: no words at all (the label already says
  // so — an outage, an absence) versus words that never named this piece.
  const sentences = isBook ? [] : extractSentences(state.rationale, symbol);
  const hasWords = Boolean(state.rationale);
  const notNamed = !isBook && hasWords && sentences.length === 0
    ? COPY.notNamedAtCheck(state.checkedAt)
    : null;

  return (
    <motion.section
      role="region"
      {...(decisionHeading ? { 'aria-labelledby': id } : { 'aria-label': state.label })}
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
        {/* 1. The piece's lines — the two scoring tiers as prices, with the
               one footer naming where they come from. Omitted whole when the
               caller could not compute them from persisted values. */}
        {!isBook && tierLine && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ ...mono, fontSize: 12.5, color: cssVar('text-primary') }}>{tierLine}</div>
            <div style={{ fontSize: 10.5, color: cssVar('text-muted'), letterSpacing: '0.02em' }}>
              {COPY.fromScoringPath}
            </div>
          </div>
        )}

        {/* 2. This piece today — omitted when there is nothing to show */}
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

        {/* 3. The check — the eyebrow names the CHECK, never the piece. The
               book panel carries the whole paragraph; a row carries only the
               sentences that name it, verbatim. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {decisionHeading && <div id={id} style={eyebrow}>{decisionHeading}</div>}
          <div style={{ fontSize: 12.5, fontWeight: 700, color: LABEL_COLOR[state.kind] || cssVar('text-secondary') }}>
            {state.label}
          </div>
          {wokenBy && (
            <div style={{ fontSize: 10.5, color: cssVar('text-muted'), letterSpacing: '0.02em' }}>
              {wokenBy}
            </div>
          )}
          {isBook
            ? <Rationale text={state.rationale} symbol={symbol} />
            : sentences.map((sentence, i) => (
              <Rationale key={`s-${i}`} text={sentence} symbol={symbol} />
            ))}
          {notNamed && (
            <div style={{ fontSize: 12.5, color: cssVar('text-muted') }}>{notNamed}</div>
          )}
          {state.footer && (
            <div style={{ fontSize: 10.5, color: cssVar('text-muted'), letterSpacing: '0.02em' }}>
              {state.footer}
            </div>
          )}
          {/* The way to the whole paragraph. Only where an extract is shown,
              and only when there is a paragraph behind it to read. */}
          {!isBook && hasWords && typeof onReadFullCheck === 'function' && (
            <div>
              <button
                type="button"
                onClick={() => onReadFullCheck(symbol)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: cssVar('teal'),
                  fontSize: 11.5,
                  fontWeight: 600,
                  textAlign: 'left',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                {COPY.readFullCheck}
              </button>
            </div>
          )}
        </div>

        {/* 4. Facts — the row's own numbers, passed in. No lock line. */}
        {facts.length > 0 && (
          <div style={{ ...mono, fontSize: 11.5, color: cssVar('text-secondary') }}>
            {facts.join(' · ')}
          </div>
        )}

        {/* 5. The one door */}
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
