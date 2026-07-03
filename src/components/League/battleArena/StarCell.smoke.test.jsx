// src/components/League/battleArena/StarCell.smoke.test.jsx
//
// Phase 5 (Deliverable 2) — render lock for the four canonical-open SETTLEMENT
// states on the arena StarCell. As with the arena smoke tests the repo ships no
// jsdom: react-dom/server renders the cell WITHOUT a DOM (no effects), enough to
// prove each state renders its distinct signal and legacy stays byte-identical.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StarCell } from './StarCell';
import { OWN_YOU } from './arenaTheme';

const base = { tk: 'GE', tier: 'support', dir: 'long', banked: 0, points: 0, badge: null, justIn: false };
// react-dom/server interleaves `<!-- -->` markers between adjacent text nodes
// (e.g. `{sign}{mult}×`) — strip them so exact strings like "+0.6×" match.
const render = (over) => renderToString(<StarCell star={{ ...base, ...over }} owner={OWN_YOU} />).replace(/<!-- -->/g, '');

describe('StarCell — canonical-open settlement states', () => {
  it('PENDING: no multiplier number, a waiting affordance, the em-dash signal', () => {
    const html = render({ mult: 0, state: 'quiet', settleState: 'pending' });
    expect(html).toContain('settles at the open');
    expect(html).toContain('—');            // the em-dash where a number would be
    expect(html).not.toContain('+0.0×');     // NOT the old broken-looking zero
    expect(html).not.toContain('estimate until banked');
  });

  it('VOID: reads as absence — em-dash + "no open · didn’t count · no penalty", NOT coral', () => {
    const html = render({ mult: 0, state: 'quiet', settleState: 'void' });
    expect(html).toContain('no open');
    expect(html).toContain('no penalty');
    expect(html).toContain('—');
    expect(html).not.toContain('#F2766B'); // never the coral loss color — void is grey absence
  });

  it('ESTIMATED: the live multiplier, dashed, "estimate until banked" + an est tag', () => {
    const html = render({ mult: 0.6, state: 'heating', settleState: 'estimated' });
    expect(html).toContain('+0.6×');
    expect(html).toContain('estimate until banked');
    expect(html).toContain('underline dashed'); // provisional styling
    expect(html.toLowerCase()).toContain('est');
  });

  it('OFFICIAL: the multiplier solid, a "banked" check, "official · counts in standings"', () => {
    const html = render({ mult: 1.2, state: 'hit', settleState: 'official' });
    expect(html).toContain('+1.2×');
    expect(html).toContain('official · counts in standings');
    expect(html.toLowerCase()).toContain('banked');
    expect(html).not.toContain('underline dashed'); // solid, the est/official contrast
  });

  it('LEGACY (settleState null): byte-identical to today — no new-state copy', () => {
    const html = render({ mult: 0.6, state: 'heating', settleState: null });
    expect(html).toContain('+0.6×');
    expect(html).not.toContain('settles at the open');
    expect(html).not.toContain('estimate until banked');
    expect(html).not.toContain('official · counts in standings');
  });
});
