// src/screens/battleView/ThisTurnStrip.jsx
//
// This turn — the strip above the board (Phase A, A3; design brief §3.3,
// D-49). STRICT membership: it holds only what is unresolved and check-bound,
// which in Phase A is the current directive. Presence in the strip is itself
// a claim — "something is outstanding for the next check" — so it never
// carries research, signals or answered items, and it EMPTIES when the battle
// is complete (there is no next check to be outstanding for).
//
// `Filed {t}` + the directive text: the time is the filing EXCHANGE's
// timestamp (the same source Replaced keys off — deriveReceipts.js), never
// battle.directive.createdAt. No "for the ~1:02 check" (hazard 3): filed is
// not heard, and the interface must not promise the next check will read it.
// Empty: `Nothing queued · next check ~{t}`, with the adapter's next — or
// `Nothing queued` alone when there is no honest next (late, closed).
//
// Every string comes from battleViewCopy.js.

import React from 'react';
import { cssVar } from '../../theme/cssTokens';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

export default function ThisTurnStrip({ directive = null, receipts = null, battleStatus = null, turn = null }) {
  if (battleStatus === 'completed') return null;

  const threadId = typeof directive?.directiveThreadId === 'string' ? directive.directiveThreadId : null;
  const text = typeof directive?.text === 'string' && directive.text.trim() ? directive.text : null;
  const queued = Boolean(threadId && text);
  const filedAt = queued ? (receipts?.[threadId]?.at ?? null) : null;
  // Phase B: presence-gated — the receipt carries the record's Heard stamp for
  // this thread only when a stamped entry named it.
  const heardStamp = queued ? (receipts?.[threadId]?.heard ?? null) : null;
  const heardLine = queued ? COPY.heardLine(receipts?.[threadId] ?? null) : null;

  return (
    <div
      data-this-turn={queued ? 'filed' : 'empty'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        padding: '8px 16px',
        borderBottom: `1px solid rgba(${cssVar('scrim-rgb')}, 0.07)`,
      }}
    >
      <div style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: cssVar('text-muted'),
      }}>
        {COPY.thisTurn}
      </div>
      {queued ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 11,
              color: cssVar('teal'),
              whiteSpace: 'nowrap',
            }}>
              {COPY.filed(filedAt)}
            </span>
            <span style={{ fontSize: 12.5, color: cssVar('text-primary'), lineHeight: 1.4 }}>
              {text}
            </span>
          </div>
          {/* Phase B (seed §1): the record's Heard line for THIS thread, or
              the reasonless negative, or nothing when no stamped entry names
              it. Still no "for the ~{t} check" (hazard 3) — Heard is a proven
              PAST fact about a check that already ran, never a promise about
              the next one. */}
          {heardLine ? (
            <div
              data-heard={heardStamp?.heard ? 'heard' : 'not-heard'}
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontVariantNumeric: 'tabular-nums',
                fontSize: 10.5,
                color: cssVar('text-secondary'),
              }}
            >
              {heardLine}
            </div>
          ) : null}
        </>
      ) : (
        <div style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 11,
          color: cssVar('text-secondary'),
        }}>
          {COPY.nothingQueued(turn?.nextDecisionAt ?? null)}
        </div>
      )}
    </div>
  );
}
