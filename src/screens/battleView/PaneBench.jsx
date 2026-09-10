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

// PHASE B (seed §3) — a name the check FLAGGED as a potential entry joins the
// named group with a `Flagged` chip, instead of sitting in the rest of the
// roster. The fact of the flag only: no signal text, no threshold, no reason
// (D-103). Presence-gated like every other Phase B surface — no candidates
// stamp, no flagged names, and the section renders exactly as it does today.

import React from 'react';
import { cssVar } from '../../theme/cssTokens';
import { parseEmphasis } from './selectWhyState';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
// Phase C §1 — the door's enabled state, from the ONE cap display function
// (D-122). This pane counts nothing itself.
import { researchDoorEnabled } from '../../data/researchCap';

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
function Chip({
  symbol, spokenFor = false, onShowIt = null,
  researchUsed = 0, researchPending = false, researchError = null,
}) {
  // Phase C §1 — THE BENCH CHIP CARRIES THE SAME DOOR. With a handler it is a
  // button; without one it is the shipped `<span>`, byte for byte, which is
  // what it stays while SHOW_IT_ENABLED is dark. The VISIBLE label is the
  // symbol either way — a chip is a chip, and the roster has to keep reading as
  // one bench rather than a row of ratios — so the door's cost lives in the
  // accessible name, which is where the scopeDoorName rule already puts what a
  // control does. Exhausted disables it, exactly as the panel's door.
  const door = typeof onShowIt === 'function';
  const enabled = door && !researchPending && researchDoorEnabled(researchUsed);
  const Tag = door ? 'button' : 'span';
  // THE FAILURE IS THIS CHIP'S OR NOBODY'S. `researchError` names the SYMBOL
  // whose tap failed, so the roster's other chips say nothing — one failed tap
  // on MPC must not put a line beside every name on the bench. Compared, never
  // read as a flag. `answered` rides along and decides WHICH sentence, in the
  // copy layer (decisionRecord.js `researchFailureLine`).
  const failed = door && researchError?.symbol === symbol;
  const chip = (
    <Tag
      data-bench-chip={symbol}
      data-bench-chip-named={spokenFor ? 'true' : 'false'}
      {...(door ? {
        type: 'button',
        'data-bench-chip-door': 'showit',
        'aria-label': COPY.showItDoorName(symbol, researchUsed),
        title: enabled ? undefined : COPY.showItExhausted,
        disabled: !enabled,
        onClick: () => onShowIt(symbol),
      } : {})}
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
        ...(door ? { cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.5 } : null),
      }}
    >
      {symbol}
    </Tag>
  );
  // NO FAILURE, NO WRAPPER — the chip is what it is today, byte for byte, on
  // every render but the one that failed (the D-113 presence rule the Heard
  // line is built on). The wrapper is the `Flagged` chip's own shape, so a
  // name and the thing said about it stay one unit when the row wraps.
  if (!failed) return chip;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {chip}
      <span
        data-bench-showit-error={symbol}
        data-bench-showit-answered={researchError.answered ? 'true' : 'false'}
        role="alert"
        style={{ ...mono, fontSize: 10, color: cssVar('text-muted') }}
      >
        {COPY.showItDoorFailed(researchError.answered)}
      </span>
    </span>
  );
}

export default function PaneBench({
  bench = null, onShowIt = null,
  researchUsed = 0, researchPending = false, researchError = null,
}) {
  if (!bench) return null;
  // One place decides what every chip on this pane is (BUILD_RULES §9).
  const door = { onShowIt, researchUsed, researchPending, researchError };
  const { slotIso, cards, flagged = [], rest, watchlistName, footer } = bench;
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
      {(cards.length > 0 || flagged.length > 0) && (
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
                {symbols.map((symbol) => <Chip key={symbol} symbol={symbol} spokenFor {...door} />)}
              </div>
            </div>
          ))}
          {/* THE FLAG (Phase B, seed §3). Names this check flagged as potential
              entries but spoke no sentence about — the fact of the flag, with
              no signal text behind it. */}
          {flagged.length > 0 && (
            <div data-bench-flagged="1" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
              {flagged.map((symbol) => (
                <span key={symbol} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Chip symbol={symbol} spokenFor {...door} />
                  <span
                    data-bench-flag-chip={symbol}
                    style={{
                      ...mono,
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      padding: '2px 5px',
                      borderRadius: 3,
                      color: cssVar('text-muted'),
                      border: `1px solid rgba(var(--ft-scrim-rgb), 0.14)`,
                    }}
                  >
                    {COPY.benchFlaggedChip}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* WHOSE WORDS (D-80). The check and trade cards carry this line
              under the same sentences; Bench is the fourth surface to quote a
              rationale and must not be the one that leaves it unattributed.
              GATED ON THE CARDS, NOT ON THE GROUP (review A-1): the line is an
              authorship claim about QUOTED TEXT, and a group holding only a
              `Flagged` chip quotes nothing — "The agent's own words" over a
              bench name the agent wrote nothing about is the exact
              mis-attribution D-80 exists to prevent. Phase B widened the
              group's gate to admit a flag with no sentence; this gate did not
              widen with it. */}
          {cards.length > 0 && footer && (
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
            {rest.map((symbol) => <Chip key={symbol} symbol={symbol} {...door} />)}
          </div>
        </div>
      )}

      {/* Assignments land here later — an empty slot, no UI (the seed's own
          words). The mock's dashed placeholder is not built. */}
      <div data-bench-assignments="1" aria-hidden="true" />
    </div>
  );
}
