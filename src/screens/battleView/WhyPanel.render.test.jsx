// src/screens/battleView/WhyPanel.render.test.jsx
//
// Phase A (A2) — the Why? panel renders the agent's own words under the right
// verb, the row's own numbers, no lock line, and one door. The DOWNGRADED
// fixture is the founder smoke's step-3 fallback: a tick where the model
// argued for a swap and a guardrail held it (`downgraded: true` on the
// evaluations[] entry), rendered from a fixture so the state is guaranteed
// even if the live battle has no such tick today.
//
// renderToString + toContain, the repo's component-test idiom.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import WhyPanel from './WhyPanel.jsx';
import { selectWhyState, selectTradesForSymbol, WHY_KIND } from './selectWhyState';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

const LAST = '2026-09-01T16:47:00.000Z'; // 12:47 PM ET
const TS = '2026-09-01T16:47:02.000Z';

// The downgraded tick — the smoke fallback fixture.
const DOWNGRADED = {
  evalId: 'eval_014',
  timestamp: TS,
  decision: 'HOLD',
  downgraded: true,
  validationErrors: ['ANTI-THRASH: SLB was swapped in 41 minutes ago'],
  rationale: 'SLB has lost its bid and DVN is showing the stronger tape; swapping SLB for DVN keeps the energy exposure with the leader.',
  symbolOut: null,
  symbolIn: null,
};
const HELD = { evalId: 'eval_015', timestamp: TS, decision: 'HOLD', downgraded: false, rationale: 'Held SLB through the 12:45 bar — bust-tier distance widened on the reversal, so the position stays as sized.' };
const SWAPPED = { evalId: 'eval_016', timestamp: TS, decision: 'SWAP', downgraded: false, rationale: 'Rotating SLB into DVN on relative strength.', symbolOut: 'SLB', symbolIn: 'DVN' };

const PROXIMITY = { text: '📉 5.7% to Bust', label: 'Bust', distance: 5.7, direction: 'negative', achievement: null };
const TRADES = [
  { symbolOut: 'MU', symbolIn: 'SLB', swappedOutAt: '2026-09-01T15:02:00.000Z', exitReason: 'haiku_decision', rationale: 'MU rolled over; SLB leads energy.' },
];

const strip = (h) => h.replace(/<!-- -->/g, '');
const renderRow = (evaluation, over = {}) => strip(renderToString(
  <WhyPanel
    symbol="SLB"
    state={selectWhyState(evaluation, 'SLB', LAST)}
    proximity={PROXIMITY}
    entryPrice={34.1}
    heldSince="2026-09-01T15:02:00.000Z"
    trades={selectTradesForSymbol(TRADES, 'SLB')}
    onAskFollowUp={() => {}}
    {...over}
  />,
));

describe('the downgraded state (smoke step 3 fallback)', () => {
  it('labels the tick `Argued for a swap · held by a guardrail`, never `Held`, with the footer', () => {
    const html = renderRow(DOWNGRADED);
    expect(html).toContain('Argued for a swap · held by a guardrail');
    expect(html).toContain('The agent&#x27;s own words · the system held it');
    expect(html).toContain('data-why-kind="downgraded"');
    expect(html).not.toMatch(/>Held</);
  });

  it('renders the rationale verbatim (the agent\'s own words), with the tapped symbol emphasised', () => {
    const html = renderRow(DOWNGRADED);
    expect(html).toContain('has lost its bid and DVN is showing the stronger tape');
    expect(html).toMatch(/<strong[^>]*>SLB<\/strong>/);
  });
});

describe('the fourth state — a swap that did not go through (D-66)', () => {
  // The state object is built directly here so that the selector's branch is
  // guarded by exactly one row (selectWhyState.test.js); this row guards the
  // panel's rendering of the kind — its label, its footer, its colour slot.
  const FAILED_STATE = {
    kind: WHY_KIND.FAILED, checkedAt: LAST, header: 'At the 12:47 PM check', symbol: 'SLB',
    label: COPY.failedLabel, footer: COPY.failedFooter, rationale: DOWNGRADED.rationale, symbolOut: null, symbolIn: null,
  };

  it('labels the tick `Argued for a swap · it did not go through` with its own footer — never the guardrail words', () => {
    const html = renderRow(HELD, { state: FAILED_STATE });
    expect(html).toContain('Argued for a swap · it did not go through');
    expect(html).toContain('The agent&#x27;s own words · the position stayed as it was');
    expect(html).toContain('data-why-kind="failed"');
    expect(html).not.toContain('guardrail');
    expect(html).not.toContain('the system held it');
    expect(html).not.toMatch(/>Held</);
    // The label has a colour of its own (not the fallback slot).
    expect(html).toContain('color:var(--ft-amber)');
  });
});

describe('the other states', () => {
  it('HOLD → `Held` + rationale', () => {
    const html = renderRow(HELD);
    expect(html).toContain('>Held<');
    expect(html).toContain('bust-tier distance widened on the reversal');
    expect(html).toContain('data-why-kind="held"');
    expect(html).not.toContain('guardrail');
  });

  it('SWAP → `Swapped · SLB → DVN` + rationale', () => {
    const html = renderRow(SWAPPED);
    expect(html).toContain('Swapped · SLB → DVN');
    expect(html).toContain('Rotating');
  });

  it('absence → `No decision recorded at this check`, with the facts', () => {
    const html = renderRow(null);
    expect(html).toContain('No decision recorded at this check');
    expect(html).toContain('📉 5.7% to Bust');
    expect(html).toContain('data-why-kind="absent"');
  });
});

describe('the header, the facts and the trades', () => {
  it('the header names the CHECK: `At the 12:47 PM check`', () => {
    expect(renderRow(HELD)).toContain('At the 12:47 PM check');
  });

  it('the facts repeat the ROW\'s proximity text verbatim, plus entry and held-since', () => {
    const html = renderRow(HELD);
    expect(html).toContain('📉 5.7% to Bust · Entry $34.10 · Held since 11:02 AM');
  });

  it('renders NO lock line — the row has no lock tag and none is computed (hazards 6, 16)', () => {
    expect(renderRow(HELD).toLowerCase()).not.toContain('lock');
  });

  it('`This piece today` lists the piece\'s trades with the receipt\'s own time, symbols and the agent\'s words', () => {
    const html = renderRow(HELD);
    expect(html).toContain('This piece today');
    expect(html).toContain('11:02 AM · MU → SLB');
    expect(html).toContain('MU rolled over');
  });

  it('never renders the receipt\'s machinery code or a model-tier name (F10)', () => {
    const html = renderRow(HELD).toLowerCase();
    expect(html).not.toContain('haiku_decision');
    expect(html).not.toContain('haiku');
    expect(html).not.toContain('guardrail_');
  });

  it('omits the trades section when the piece has no trades', () => {
    const html = renderRow(HELD, { trades: [] });
    expect(html).not.toContain('This piece today');
  });

  it('renders no attribution copy (hazard 5, 12): no source / triggeredBy anywhere', () => {
    const html = renderRow(HELD);
    expect(html).not.toContain('triggeredBy');
    expect(html).not.toMatch(/\bsource\b/);
  });

  it('an engine-outage tick renders the absence state, not `Held` with the placeholder (F12)', () => {
    const outage = { ...HELD, rationale: 'Haiku call failed — defaulting to HOLD', haikuError: { failureClass: 'transport' } };
    const html = renderRow(outage);
    // D-65 (A4.0): the more specific absence label, from the persisted fact.
    expect(html).toContain('No decision recorded at this check · the evaluation timed out');
    expect(html).toContain('data-why-kind="absent"');
    expect(html).not.toContain('Haiku call failed');
    expect(html).not.toContain('Haiku');
    expect(html).not.toMatch(/>Held</);
  });

  it('with no check time at all the region still has an accessible name (F6)', () => {
    const html = strip(renderToString(
      <WhyPanel symbol="SLB" state={selectWhyState(null, 'SLB', null)} onAskFollowUp={() => {}} />,
    ));
    expect(html).toContain('aria-label="No decision recorded at this check"');
    expect(html).not.toContain('aria-labelledby');
  });
});

describe('the one door', () => {
  it('`Ask a follow-up · 1 message` — and nothing else: no Direct, no Show it (D-45, D-53)', () => {
    const html = renderRow(HELD);
    expect(html).toContain('Ask a follow-up · 1 message');
    expect(html).not.toContain('Direct');
    expect(html).not.toContain('Show it');
    expect(html).not.toContain('Look into');
  });

  it('without a handler there is no door', () => {
    expect(renderRow(HELD, { onAskFollowUp: undefined })).not.toContain('Ask a follow-up');
  });
});

describe('the book-level panel (score header)', () => {
  const renderBook = () => strip(renderToString(
    <WhyPanel symbol={null} state={selectWhyState(HELD, null, LAST)} onAskFollowUp={() => {}} />,
  ));

  it('renders the decision and the door, with no facts and no trades', () => {
    const html = renderBook();
    expect(html).toContain('At the 12:47 PM check');
    expect(html).toContain('>Held<');
    expect(html).toContain('Ask a follow-up · 1 message');
    expect(html).not.toContain('Entry $');
    expect(html).not.toContain('Held since');
    expect(html).not.toContain('This piece today');
    expect(html).toContain('data-why-symbol="book"');
  });

  it('carries NO This turn copy — the strip has one home, above the board (A4)', () => {
    const html = renderBook();
    expect(html).not.toContain('This turn');
    expect(html).not.toContain('data-this-turn');
    // Order: the decision, then the door — nothing between them.
    expect(html.indexOf('At the 12:47 PM check')).toBeLessThan(html.indexOf('Ask a follow-up'));
  });
});

describe('copy guard on the rendered output', () => {
  it('no agent verb reaches the html', () => {
    const html = renderRow(DOWNGRADED).toLowerCase();
    for (const term of ['watching', 'thinking', 'researching', 'analyzing', 'about to', 'close to trading', 'wants to', 'looking at', 'eyeing', 'considering']) {
      expect(html).not.toContain(term);
    }
  });

  it('is a labelled region for assistive tech', () => {
    const html = renderRow(HELD);
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-labelledby="why-SLB-heading"');
    expect(html).toContain('id="why-SLB-heading"');
  });
});
