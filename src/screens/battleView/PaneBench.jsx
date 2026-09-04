// src/screens/battleView/PaneBench.jsx
//
// A3.3 — BENCH (D-92).
//
// What the decider NAMED on the bench at the last check that carries words,
// verbatim, then the rest of the roster. Nothing else: no narrator text, no
// reason chips (the scouting-board join is a later item), no per-name percent
// (there is no source — no bench price is polled on this screen), and an empty
// slot for assignments with no UI of its own.
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

export default function PaneBench({ bench = null }) {
  if (!bench) return null;
  const { slotIso, named, rest, watchlistName } = bench;
  const subtitle = COPY.benchWatchlist(watchlistName);
  const atCheck = COPY.atCheck(slotIso);

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

      {/* The named names, each under the slot its words came from. */}
      {named.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={heading}>{COPY.benchNamed}</div>
          {atCheck && (
            <div data-bench-slot="1" style={{ ...mono, fontSize: 10.5, color: cssVar('text-muted') }}>
              {atCheck}
            </div>
          )}
          {named.map(({ symbol, sentences }) => (
            <div
              key={symbol}
              data-bench-named={symbol}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                paddingLeft: 10,
                borderLeft: `2px solid ${cssVar('teal')}`,
              }}
            >
              <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: cssVar('teal') }}>{symbol}</span>
              {sentences.map((text, i) => (
                <span key={i} style={{ fontSize: 12.5, lineHeight: 1.45, color: cssVar('text-secondary') }}>
                  <Sentence text={text} />
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ABSENCE — a truthful state (D-92). No entry today carries words at
          all, so there is no slot to name and every bench name is "rest". */}
      {!slotIso && (
        <div data-bench-absent="1" style={{ ...mono, fontSize: 11, color: cssVar('text-muted') }}>
          {COPY.benchNoCheck}
        </div>
      )}

      {/* The rest of the roster. Under the flag each carries the ruled
          `Not named at the {t} check`; with no check to name, the names stand
          alone beneath the absence line above. */}
      {rest.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={heading}>{COPY.benchRest}</div>
          {rest.map((symbol) => (
            <div
              key={symbol}
              data-bench-rest={symbol}
              style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}
            >
              <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: cssVar('text-secondary') }}>{symbol}</span>
              {slotIso && (
                <span style={{ ...mono, fontSize: 10.5, color: cssVar('text-muted') }}>
                  {COPY.notNamedAtCheck(slotIso)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Assignments land here later — an empty slot, no UI (the seed's own
          words). The mock's dashed placeholder is not built. */}
      <div data-bench-assignments="1" aria-hidden="true" />
    </div>
  );
}
