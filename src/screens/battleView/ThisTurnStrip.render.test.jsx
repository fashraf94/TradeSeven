// src/screens/battleView/ThisTurnStrip.render.test.jsx
//
// Phase A (A3) — This turn holds only the unresolved, check-bound item (the
// current directive), stamps it with the filing exchange's time, promises
// nothing about the next check, and empties when the battle is complete.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ThisTurnStrip from './ThisTurnStrip.jsx';
import { deriveReceipts } from './deriveReceipts';

const T1 = '2026-09-01T15:31:00.000Z'; // 11:31 AM ET
// createdAt is planted in a DIFFERENT minute from the filing exchange, so a
// strip that read directive.createdAt would render 11:33, not 11:31 (T7).
const DIRECTIVE = { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1', createdAt: '2026-09-01T15:33:00.000Z' };
const EXCHANGES = [
  { userMessage: 'protect the lead', agentResponse: 'Got it.', hasDirective: true, directive: { text: DIRECTIVE.text, expiry: 'end_of_battle', directiveThreadId: 't-1' }, directiveThreadId: 't-1', timestamp: T1 },
];
const TURN = { nextDecisionAt: '2026-09-01T17:02:00.000Z' };

const strip = (h) => h.replace(/<!-- -->/g, '');
const render = (props) => strip(renderToString(<ThisTurnStrip {...props} />));

describe('ThisTurnStrip', () => {
  it('a filed directive: `Filed {t}` from the EXCHANGE timestamp, plus the text — no promise about the next check', () => {
    const html = render({ directive: DIRECTIVE, receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'active'), battleStatus: 'active', turn: TURN });
    expect(html).toContain('Filed 11:31 AM');
    expect(html).not.toContain('11:33');
    expect(html).toContain('Protect the lead into the close');
    expect(html).toContain('data-this-turn="filed"');
    expect(html).not.toContain('for the');
    expect(html).not.toContain('1:02');
  });

  // Review C-1. `COPY.heardLine` has TWO callers, and the widened positive was
  // reasoned about only for the scrollback card. `deriveReceipts` never hands
  // the strip a non-`filed` receipt today (the slot thread is `currentId`, and
  // the strip returns null on `completed`), so this is unreachable — which is
  // exactly why it is worth pinning: the strip's whole contract is "only what
  // is unresolved and check-bound", and a past-tense `Heard at the {slot}
  // check` belongs on the scrollback card, not here. If either invariant ever
  // moves, this row fails instead of the strip quietly gaining a past fact.
  // …and it stays this file's rule after the negative gained its slot: BOTH
  // verdicts now travel across card states (battleViewCopy `heardLine`), so
  // the `filed` gate here is the strip's alone, and it is the only one left.
  it('a non-`filed` receipt puts NO Heard line on the strip, positive or negative', () => {
    for (const state of ['replaced', 'expired']) {
      for (const heard of [{ at: T1, heard: true }, { at: T1, heard: false }]) {
        const html = render({
          directive: DIRECTIVE,
          receipts: { 't-1': { state, at: T1, heard } },
          battleStatus: 'active',
          turn: TURN,
        });
        expect(html).not.toContain('data-heard');
        expect(html).not.toContain('Heard at the');
        expect(html).not.toContain('Not heard at the');
      }
    }
    // …and the same stamp under `filed` DOES render, so the row above is the
    // state doing the work and not a helper that renders nothing.
    const filed = render({
      directive: DIRECTIVE,
      receipts: { 't-1': { state: 'filed', at: T1, heard: { at: T1, heard: true } } },
      battleStatus: 'active',
      turn: TURN,
    });
    expect(filed).toContain('Heard at the 11:30 AM check');
  });

  it('empty: `Nothing queued · next check ~{t}` with the adapter\'s next', () => {
    const html = render({ directive: null, receipts: {}, battleStatus: 'active', turn: TURN });
    expect(html).toContain('Nothing queued · next check ~1:00 PM');
    expect(html).toContain('data-this-turn="empty"');
  });

  it('empty with no honest next (late, closed): `Nothing queued` alone', () => {
    const html = render({ directive: null, receipts: {}, battleStatus: 'active', turn: { nextDecisionAt: null } });
    expect(html).toContain('Nothing queued');
    expect(html).not.toContain('next check');
  });

  it('battle complete → the strip empties entirely', () => {
    expect(render({ directive: DIRECTIVE, receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'completed'), battleStatus: 'completed', turn: TURN })).toBe('');
  });

  it('a directive whose filing exchange is missing still shows Filed, without inventing a time', () => {
    const html = render({ directive: DIRECTIVE, receipts: {}, battleStatus: 'active', turn: TURN });
    expect(html).toContain('>Filed<');
    expect(html).not.toContain('11:31');
  });

  // Phase B amended the last term: `heard` is no longer banned outright, it is
  // PRESENCE-GATED. These receipts carry no stamp, so its absence here proves
  // the gate rather than a vocabulary ban (the Heard rows are below).
  it('names the strip and nothing else — no agent verb, and no Heard without a stamp', () => {
    const html = render({ directive: DIRECTIVE, receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'active'), battleStatus: 'active', turn: TURN }).toLowerCase();
    expect(html).toContain('this turn');
    for (const term of ['watching', 'thinking', 'analyzing', 'about to', 'considering', 'heard']) {
      expect(html).not.toContain(term);
    }
  });
});

// ── Phase B (B1 client half, seed §1) ───────────────────────────────────────
describe('This turn — the Heard line', () => {
  const receiptsWith = (stamp) => {
    const receipts = deriveReceipts(EXCHANGES, DIRECTIVE, 'active');
    receipts['t-1'] = { ...receipts['t-1'], heard: stamp };
    return receipts;
  };

  it('a heard directive reads `Heard at the {slot} check` beneath Filed — the slot, not the minute', () => {
    const html = render({ directive: DIRECTIVE, receipts: receiptsWith({ at: T1, heard: true }), battleStatus: 'active', turn: TURN });
    expect(html).toContain('Filed 11:31 AM');            // the exchange's minute
    expect(html).toContain('data-heard="heard"');
    // THE WHOLE LINE, not a prefix (review C-3). `toContain` passes on
    // `Heard at the 11:30 AM check and acted on it`; only an exact pin fails
    // on an appended clause, and an appended clause is exactly how the verb
    // gets upgraded. The capture uses the fail-loud form — `(… || [])[1]` then
    // `toBe` — so a markup change reddens instead of silently matching '' (V-7).
    const line = (html.match(/data-heard="[^"]*"[^>]*>([^<]*)</) || [])[1];
    expect(line).toBe('Heard at the 11:30 AM check');
    // Still no promise about the NEXT check (hazard 3).
    expect(html).not.toContain('for the');
  });

  it('a withheld directive reads the flat line and never the reason', () => {
    for (const reason of ['malformed', 'mode_not_enforce', 'epoch_killed', 'unknown']) {
      const html = render({ directive: DIRECTIVE, receipts: receiptsWith({ at: T1, heard: false, reason }), battleStatus: 'active', turn: TURN });
      expect(html).toContain('data-heard="not-heard"');
      const line = (html.match(/data-heard="[^"]*"[^>]*>([^<]*)</) || [])[1];
      expect(line).toBe('Not heard at the 11:30 AM check');
      expect(html).not.toContain(reason);
      expect(html).not.toContain('Heard at the');
    }
  });

  it('no stamp → no line, and the strip is byte-identical to Phase A', () => {
    // THE `toBe` ALONE CANNOT FAIL (review B-3): both sides render the current
    // component, so a fragment turned into a wrapper div would appear on both.
    // The ELEMENT COUNT is the guard that bites — Phase B's `<>…</>` adds no
    // DOM node, so an unstamped strip must have exactly the divs Phase A had,
    // and a stamped one exactly one more.
    const base = render({ directive: DIRECTIVE, receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'active'), battleStatus: 'active', turn: TURN });
    const withNull = render({ directive: DIRECTIVE, receipts: receiptsWith(null), battleStatus: 'active', turn: TURN });
    // ABSOLUTE, not relative (review B-3b): comparing two renders of the SAME
    // component counts the mutation on both sides and passes. Phase B's
    // `<>…</>` adds no DOM node, so the unstamped strip has exactly the three
    // divs Phase A had — the strip, its eyebrow, and the filed row — and a
    // wrapper element anywhere in that path makes it four.
    const divs = (html) => (html.match(/<div/g) || []).length;
    expect(withNull).toBe(base);
    expect(withNull).not.toContain('data-heard');
    expect(divs(base)).toBe(3);
    expect(divs(withNull)).toBe(3);
    // One more, and only one, once the Heard line has something to add.
    expect(divs(render({ directive: DIRECTIVE, receipts: receiptsWith({ at: T1, heard: true }), battleStatus: 'active', turn: TURN })))
      .toBe(4);
  });
});
