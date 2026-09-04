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
//      and none of it was about this piece. `Read the full check` opens THAT
//      CHECK'S OWN CARD in the conversation (D-89, superseding A2.3 ruling 4,
//      which sent it to the book panel above the board).
//   4. The plan at deploy (A2.1b, D-76) — the deploy decision's own persisted
//      output, labelled with the deploy date so it reads as history. A row
//      carries only the sentences of ITS TIER's rationale that name it; the
//      book panel carries the brief. Gated off system strings by
//      selectDeployPlan.js; absent entirely when the caller passes nothing.
//   5. Facts — the row's proximity text (passed in), entry, held since.
//   6. One door: Ask a follow-up · 1 message → the composer, prefilled.
// Book-level (the score header): 3 with the FULL rationale, 4's brief → the
// door. No lines, no facts. This turn has ONE home — the strip above the board
// (A4); the panel carries no second copy.
//
// THE FULL PARAGRAPH NEVER RENDERS ON A ROW (D-75). Before A2 every one of the
// seven rows showed the same block of text — one paragraph about the book,
// claimed seven times as a paragraph about a piece.
//
// Every string comes from battleViewCopy.js; the panel types no prose.
// Colours via the token bridge; motion via the vocabulary, reduced-motion
// aware; the expansion is the only motion and it plays once per open.

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cssVar } from '../../theme/cssTokens';
import { motionToken } from '../../theme/motion';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { WHY_KIND, emphasizeSymbol, extractSentences, splitSentences, parseEmphasis } from './selectWhyState';

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

/**
 * The engine's own sentence, with the two emphases it can carry.
 *
 * MARKDOWN FIRST, THEN THE SYMBOL (flip-prep item 3). `parseEmphasis` removes
 * the `**` markers, so the symbol pass sees words rather than markup. The
 * stated reason for the ordering used to be that `**SLB is done**` "would
 * otherwise never match SLB against a whole-word boundary that an asterisk
 * sits on" — that is FALSE and is corrected here (review L1-F7):
 * `symbolPattern`'s leading boundary is `(^|[^A-Za-z0-9])`, which `*`
 * satisfies, so the match survives either order. The real reason is simpler:
 * run the symbol pass first and the markers render literally, because nothing
 * downstream would strip them. The symbol pass then runs INSIDE each segment,
 * so a symbol inside the model's own emphasis gets both and neither swallows
 * the other.
 *
 * The two read differently on purpose: the symbol is teal (it is the piece you
 * tapped, and it is a link between this text and the row above it), the
 * model's own stress is the body colour in bold (it is emphasis, not an
 * address). One colour for both would make the panel look like it had
 * underlined half the paragraph.
 */
function Rationale({ text, symbol }) {
  if (!text) return null;
  return (
    <p style={{
      margin: 0,
      fontSize: 13,
      lineHeight: 1.5,
      color: cssVar('text-primary'),
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {parseEmphasis(text).map((span, si) => {
        const inner = emphasizeSymbol(span.text, symbol).map((seg, i) => (seg.emphasized
          ? <strong key={i} style={{ color: cssVar('teal'), fontWeight: 700 }}>{seg.text}</strong>
          : <React.Fragment key={i}>{seg.text}</React.Fragment>));
        return span.strong
          ? <strong key={`e-${si}`} style={{ fontWeight: 700 }}>{inner}</strong>
          : <React.Fragment key={`e-${si}`}>{inner}</React.Fragment>;
      })}
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
  deployPlan = null,
  deployPlanForSymbol = null,
  trades = [],
  onAskFollowUp,
  onReadFullCheck = null,
  reducedMotion = false,
  headingId,
  // A2.3 (D-73): how much of the conversation is about this piece, and the
  // handler that scopes the tape to it. `mentionCount` is the LENGTH of the
  // list `onScopeToPiece` opens (scopeTape.js) — the panel renders it, it
  // never derives it. Both null on the book panel and flag-off.
  mentionCount = null,
  onScopeToPiece = null,
  // D-89 — the book panel's close. The panel is a DISCLOSURE the score header
  // owns: the header carries the `aria-expanded`, so the way out has to hand
  // focus back to it or a keyboard reader is stranded on a region that has no
  // owner. Null on a row panel, which closes by tapping its row again.
  onCloseBook = null,
}) {
  // D-89: the book panel OPENS COLLAPSED. Before this it opened with the whole
  // paragraph, the deploy brief and the door all at once, above the board —
  // on a long check that pushed the board off the screen the panel was meant
  // to explain. Collapsed it is five short lines; the rest is one tap away and
  // lands in a bounded region rather than in the page's own height.
  //
  // LOCAL STATE, and deliberately so: an expansion is not a fact about the
  // battle (the same rule the tape's `Read more` follows).
  //
  // "Every open starts collapsed" is true because the SCREEN gives this panel
  // a key that changes on each open — not because it unmounts, which is what
  // this comment used to claim (review L2-F5). It sits inside
  // `AnimatePresence` with a 300 ms exit, so a re-open inside that window
  // reconciles onto the exiting fiber and keeps whatever state it had. A
  // double-tap on the score header was enough to re-open it fully expanded.
  const [expanded, setExpanded] = useState(false);
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

  // D-89 — what the COLLAPSED book panel shows of the check's words: the first
  // sentence, and `Read more` only when there is more than that behind it. The
  // same rule, and the same trim, the tape's records use (TapeCards'
  // RecordProse), because one paragraph shown two ways on two surfaces is the
  // disagreement §9 exists to prevent.
  const bookFull = typeof state.rationale === 'string' ? state.rationale.trim() : '';
  const bookOpening = isBook ? (splitSentences(bookFull)[0] ?? bookFull) : '';
  const bookHasMore = isBook && Boolean(bookFull) && bookFull !== bookOpening;
  const notNamed = !isBook && hasWords && sentences.length === 0
    ? COPY.notNamedAtCheck(state.checkedAt)
    : null;

  // The plan's label carries the deploy date (D-76 gate c). Null when the doc
  // has no usable date, and the section is then absent whole rather than
  // dropping to an undated label the ruling does not contain (review L5-F6).
  const planLabel = deployPlan ? COPY.planAtDeploy(deployPlan.activatedAt) : null;

  return (
    <motion.section
      role="region"
      {...(decisionHeading ? { 'aria-labelledby': id } : { 'aria-label': state.label })}
      data-why-kind={state.kind}
      data-why-symbol={isBook ? 'book' : symbol}
      // Focusable so the panel can be moved to programmatically. A2.3's
      // ruling 4 used to send `Read the full check` here; D-89 sends it to the
      // check's own card instead, so the only reader who lands on this region
      // now is one who opened it from the score header.
      tabIndex={-1}
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
                {t.footer && (
                  <div style={{ fontSize: 10.5, color: cssVar('text-muted'), letterSpacing: '0.02em' }}>
                    {t.footer}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 3. The check — the eyebrow names the CHECK, never the piece. The
               book panel carries the whole paragraph; a row carries only the
               sentences that name it, verbatim.
               D-89: on the book panel the heading row also carries the CLOSE.
               The score header owns this panel's `aria-expanded`, so the way
               out belongs beside the thing it closes and hands focus back to
               that header — a region a keyboard reader can enter and not
               leave is worse than one that never opened. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* `role="heading"` + `aria-level` — added for A2.3's ruling 4, which
              said `Read the full check` "moves focus to its first HEADING",
              and KEPT after D-89 retargeted that door. The reason changed and
              the value did not: this region is a disclosure the score header
              owns, and a panel whose title is not a heading is one a screen
              reader cannot navigate to or summarise. It changes no pixel — the
              eyebrow keeps its own type scale. Level 3: the panel opens under
              the row it belongs to. */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            {decisionHeading && (
              <div id={id} tabIndex={-1} role="heading" aria-level={3} style={{ ...eyebrow, flex: 1, minWidth: 0 }}>
                {decisionHeading}
              </div>
            )}
            {isBook && typeof onCloseBook === 'function' && (
              <button
                type="button"
                data-why-book-close="1"
                aria-label={COPY.closeWhyBookName}
                onClick={onCloseBook}
                style={{
                  background: 'transparent',
                  border: 'none',
                  // A REAL TARGET (review L1-F5). This was a bare 14px glyph
                  // with `padding: 0` — roughly 8×14 CSS px, under the 24×24
                  // minimum and nowhere near a 44px touch target. On a phone
                  // the only way out of the panel was near-untappable, which
                  // defeats the half of D-89 that says a reader must be able
                  // to leave. Negative margins keep the glyph optically where
                  // it was while the hit area grows around it.
                  padding: 10,
                  margin: '-10px -10px -10px auto',
                  minWidth: 44,
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  flexShrink: 0,
                  color: cssVar('text-muted'),
                  fontSize: 14,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: LABEL_COLOR[state.kind] || cssVar('text-secondary') }}>
            {state.label}
          </div>
          {wokenBy && (
            <div style={{ fontSize: 10.5, color: cssVar('text-muted'), letterSpacing: '0.02em' }}>
              {wokenBy}
            </div>
          )}
          {isBook
            ? (
              /* Collapsed: the first sentence. Expanded: the whole paragraph
                 inside a BOUNDED, scrollable region (D-89). The bound is what
                 makes the tap safe — an unbounded expansion above the board
                 pushes the board off the screen, which is the defect this
                 ruling exists to close, and a long check is the ordinary case
                 rather than the edge one. `overscrollBehavior: contain` keeps
                 a flick inside the region from scrolling the page behind it. */
              expanded ? (
                <div
                  data-why-book-body="expanded"
                  style={{
                    maxHeight: '40vh',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <Rationale text={state.rationale} symbol={symbol} />
                  {/* THE BRIEF IS INSIDE THE BOUND (review L1-F3). It rendered
                      as the region's SIBLING, and `strategyBrief` is never
                      truncated — so one tap added 40vh of bounded rationale
                      PLUS an unbounded brief above the board, which is the
                      exact defect D-89 exists to close. "The rest" in the
                      ruling is everything the tap reveals, not the paragraph
                      alone. */}
                  {deployPlan?.brief && planLabel && (
                    <div data-why-book-plan="1" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={eyebrow}>{planLabel}</div>
                      <Rationale text={deployPlan.brief} symbol={symbol} />
                    </div>
                  )}
                </div>
              ) : (
                <div data-why-book-body="collapsed" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Rationale text={bookOpening} symbol={symbol} />
                  {bookHasMore && (
                    <div>
                      <button
                        type="button"
                        data-why-book-more="1"
                        onClick={() => setExpanded(true)}
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
                        {COPY.readMore}
                      </button>
                    </div>
                  )}
                </div>
              )
            )
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

        {/* 4. The plan at deploy — history, never a current decision. The row
               shows its TIER's sentences that name it; the book shows the
               brief. Absent whole when the caller gates it off. */}
        {!isBook && deployPlanForSymbol && planLabel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={eyebrow}>{COPY.atDeployTier(deployPlanForSymbol.tier)}</div>
            {deployPlanForSymbol.sentences.map((sentence, i) => (
              <Rationale key={`d-${i}`} text={sentence} symbol={symbol} />
            ))}
            <div style={{ fontSize: 10.5, color: cssVar('text-muted'), letterSpacing: '0.02em' }}>
              {planLabel}
            </div>
          </div>
        )}

        {/* 5. Facts — the row's own numbers, passed in. No lock line. */}
        {facts.length > 0 && (
          <div style={{ ...mono, fontSize: 11.5, color: cssVar('text-secondary') }}>
            {facts.join(' · ')}
          </div>
        )}

        {/* 6. The doors — the follow-up, and the way into the conversation
               about this piece (A2.3). Both are the piece's; the book panel
               keeps the follow-up alone, because "the chat about the book" is
               the chat.
               D-89: on the BOOK panel the door rides the expansion. Collapsed
               is five lines about the latest check and nothing else — a door
               under them turns a glance into a decision. */}
        {(!isBook || expanded) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {typeof onAskFollowUp === 'function' && (
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
          )}
          {/* Zero still renders (seed §A2.3): `In the chat · 0` is a true
              thing to say about a piece, and the tap opens the whole tape at
              the piece's prefill rather than an empty one. */}
          {!isBook && typeof onScopeToPiece === 'function' && COPY.inTheChat(mentionCount) && (
            <button
              type="button"
              data-why-scope={symbol}
              aria-label={COPY.scopeDoorName(symbol, mentionCount)}
              onClick={() => onScopeToPiece(symbol, mentionCount)}
              style={{
                background: 'transparent',
                border: `1px solid ${cssVar('text-muted')}`,
                color: cssVar('text-secondary'),
                borderRadius: 16,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {COPY.inTheChat(mentionCount)}
            </button>
          )}
        </div>
        )}
      </div>
    </motion.section>
  );
}
