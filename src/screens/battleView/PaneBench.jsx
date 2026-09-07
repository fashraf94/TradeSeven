// src/screens/battleView/PaneBench.jsx
//
// A3.3 — BENCH (D-92).
//
// What the decider SAID about the bench at the last check that carries words,
// verbatim, then the rest of the roster. Nothing else: no narrator text, no
// reason chips (the scouting-board join is a later item), no per-name percent
// (there is no source — no bench price is polled on this screen), and an empty
// slot for assignments with no UI of its own.
//
// SENTENCE-FIRST (founder ruling, Sep 4 — the smoke's shape fix). One card per
// SENTENCE that names at least one bench symbol, in the rationale's own order,
// with the names it mentions as chips ON the sentence. A sentence naming five
// names is one card with five chips, not five cards. The first shape grouped by
// symbol and reprinted the same sentence under each name it mentioned, which is
// what made the section read as a list rather than a bench.
//
// The roster below is a wrapped ROW OF CHIPS under one line, not a line per
// name — same reason. The chip is the shared shape between the two halves: a
// name the check spoke for, and a name it did not.
//
// EVERY SENTENCE IS THE MODEL'S OWN, rendered through `parseEmphasis` — the
// same function the Why? row, the book panel and the check card use, so one
// sentence cannot be shown four ways (D-87). `white-space: pre-wrap` for the
// same reason the other three use it.
//
// The selector hands this component finished text; there is no arithmetic here
// and no second reading of the doc.

import React from 'react';
import { cssVar } from '../../theme/cssTokens';
import { parseEmphasis } from './selectWhyState';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

const mono = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontVariantNumeric: 'tabular-nums',
};

const heading = {
  ...mono,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: cssVar('text-muted'),
};

/** One sentence, with the model's own `**…**` as emphasis and nothing else. */
function Sentence({ text }) {
  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>
      {parseEmphasis(text).map((part, i) => (
        part.strong
          ? <strong key={i} style={{ color: cssVar('text-primary'), fontWeight: 700 }}>{part.text}</strong>
          : <span key={i}>{part.text}</span>
      ))}
    </span>
  );
}

/**
 * A bench name, as a chip. ONE shape for both halves of the section: on a
 * sentence it is a name the check spoke for (teal, the player's accent), in the
 * roster row it is one it did not (muted). Nothing else differs — a chip is a
 * chip, so the eye reads the roster as the same kind of thing as the named.
 */
function Chip({ symbol, spokenFor = false }) {
  return (
    <span
      data-bench-chip={symbol}
      data-bench-chip-named={spokenFor ? 'true' : 'false'}
      style={{
        ...mono,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.2,
        padding: '3px 7px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        color: spokenFor ? cssVar('teal') : cssVar('text-secondary'),
        background: spokenFor
          ? `rgba(var(--ft-teal-rgb), 0.14)`
          : `rgba(var(--ft-scrim-rgb), 0.06)`,
        border: `1px solid ${spokenFor
          ? `rgba(var(--ft-teal-rgb), 0.34)`
          : `rgba(var(--ft-scrim-rgb), 0.10)`}`,
      }}
    >
      {symbol}
    </span>
  );
}

export default function PaneBench({ bench = null }) {
  if (!bench) return null;
  const { slotIso, cards, rest, watchlistName, footer } = bench;
  const subtitle = COPY.benchWatchlist(watchlistName);
  const namedHeading = COPY.benchNamed(slotIso);

  return (
    <div
      data-pane-bench="1"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '12px 14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {subtitle && (
        <div data-bench-watchlist="1" style={{ ...heading, color: cssVar('text-secondary') }}>
          {subtitle}
        </div>
      )}

      {/* THE SENTENCES, in the rationale's own order, under the slot they came
          from. One card each; the names it mentions ride on it. */}
      {cards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* The slot of the check ACTUALLY USED (founder ruling Sep 4). Under
              the scan-back that need not be the last check, and one heading
              carries it — the separate `At the {t} check` line beneath it said
              "check" twice in two lines. */}
          <div data-bench-slot="1" style={heading}>{namedHeading}</div>
          {cards.map(({ text, symbols }, i) => (
            <div
              // The SENTENCE's position, not a symbol: two sentences can name
              // the same set of names, and a symbol key would collide.
              key={i}
              data-bench-card={String(i)}
              data-bench-card-symbols={symbols.join(' ')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                paddingLeft: 10,
                borderLeft: `2px solid ${cssVar('teal')}`,
              }}
            >
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: cssVar('text-secondary') }}>
                <Sentence text={text} />
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {symbols.map((symbol) => <Chip key={symbol} symbol={symbol} spokenFor />)}
              </div>
            </div>
          ))}
          {/* WHOSE WORDS (D-80). The check and trade cards carry this line
              under the same sentences; Bench is the fourth surface to quote a
              rationale and must not be the one that leaves it unattributed. */}
          {footer && (
            <div data-bench-footer="1" style={{ ...mono, fontSize: 10, color: cssVar('text-muted') }}>
              {footer}
            </div>
          )}
        </div>
      )}

      {/* ABSENCE — a truthful state (D-92). No entry today carries words at
          all, so there is no slot to name and every bench name is "rest". */}
      {!slotIso && (
        <div data-bench-absent="1" style={{ ...mono, fontSize: 11, color: cssVar('text-muted') }}>
          {COPY.benchNoCheck}
        </div>
      )}

      {/* THE REST OF THE ROSTER — one line, then a wrapped row of chips. The
          ruled `Not named at the {t} check` is said ONCE, as that line; the
          first shape repeated it beside every name, which is n copies of one
          fact and the same shredding the sentences suffered. With no check to
          name (the absence state) the line falls back to the plain heading and
          the chips stand beneath the absence line above. */}
      {rest.length > 0 && (
        <div data-bench-rest-group="1" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div data-bench-rest-line="1" style={heading}>
            {(slotIso && COPY.notNamedAtCheck(slotIso)) || COPY.benchRest}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {rest.map((symbol) => <Chip key={symbol} symbol={symbol} />)}
          </div>
        </div>
      )}

      {/* Assignments land here later — an empty slot, no UI (the seed's own
          words). The mock's dashed placeholder is not built. */}
      <div data-bench-assignments="1" aria-hidden="true" />
    </div>
  );
}
