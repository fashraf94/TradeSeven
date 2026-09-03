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

const renderBook = (evaluation, over = {}) => strip(renderToString(
  <WhyPanel
    symbol={null}
    state={selectWhyState(evaluation, null, LAST)}
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
  it('a ROW\'s eyebrow says where its sentences came FROM: `From the 12:47 PM check` (A2.1)', () => {
    const html = renderRow(HELD);
    expect(html).toContain('From the 12:47 PM check');
    // `At the {t} check` is the BOOK panel's eyebrow — the panel that IS the
    // whole check. One string each, so a row never claims to be the check.
    expect(html).not.toContain('At the 12:47 PM check');
  });

  it('the BOOK panel keeps `At the 12:47 PM check` and the WHOLE paragraph', () => {
    const html = renderBook(DOWNGRADED);
    expect(html).toContain('At the 12:47 PM check');
    expect(html).not.toContain('From the 12:47 PM check');
    expect(html).toContain('SLB has lost its bid and DVN is showing the stronger tape');
    expect(html).toContain('keeps the energy exposure with the leader.');
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
    const outage = { ...HELD, rationale: 'Haiku call failed — defaulting to HOLD', haikuError: { failureClass: 'timeout' } };
    const html = renderRow(outage);
    // D-65 (A4.0): the more specific absence label, from the persisted fact.
    expect(html).toContain('No decision recorded at this check · the evaluation timed out');
    expect(html).toContain('data-why-kind="absent"');
    expect(html).not.toContain('Haiku call failed');
    expect(html).not.toContain('Haiku');
    expect(html).not.toMatch(/>Held</);
    // A budget-skipped tick is an outage too — but not a timeout (L1-F1). D-69
    // (A2.0) gives every non-timeout class the class-neutral line: true of them
    // all, and it still never names the class to the player.
    const skipped = renderRow({ ...outage, haikuError: { failureClass: 'budget_skipped' } });
    expect(skipped).toContain('No decision recorded at this check · the evaluation did not complete');
    expect(skipped).toContain('data-why-kind="absent"');
    expect(skipped).not.toContain('timed out');
    expect(skipped).not.toContain('budget');
    expect(skipped).not.toContain('Haiku');
  });

  it('the FIFTH state (D-70) names the guardrail as the subject, never the agent', () => {
    // A guardrail-forced exit whose replacement was rejected: the rationale on
    // the entry is the CRON's `Guardrail override (…)` text, not the agent's.
    const forced = {
      ...HELD,
      downgraded: true,
      rationale: 'Guardrail override (guardrail_stopLoss): SLB breached the -8% stop; forcing exit to DVN.',
      guardrailSourceNote: 'guardrail_stopLoss',
      guardrailOverrides: [{ symbol: 'SLB', action: 'forced_exit', replacementSymbol: 'DVN' }],
      validationErrors: ['Swap execution failed: EODHD price unavailable for DVN'],
    };
    const html = renderRow(forced);
    expect(html).toContain('A guardrail called for a swap · it did not go through');
    expect(html).toContain('The guardrail&#x27;s reason · the position stayed as it was');
    expect(html).toContain('data-why-kind="guardrailFailed"');
    // The system's words are still rendered verbatim — but never credited to
    // the agent (the fourth state's footer would do exactly that), and the
    // provenance code inside them is translated, never raw (D-80).
    // (the panel emphasises the tapped symbol, so the sentence is split around `SLB`)
    expect(html).toContain('Guardrail override (stop-loss): ');
    expect(html).toContain(' breached the -8% stop; forcing exit to DVN.');
    expect(html).not.toContain('guardrail_');
    expect(html).not.toContain('The agent&#x27;s own words');
    expect(html).not.toContain('Argued for a swap');
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

describe('Why? V2 — the piece\'s lines (A2.1, ruling 1)', () => {
  it('renders `Bagger $ · Bust $` footed `from the scoring path`, and nothing else', () => {
    const html = renderRow(HELD, { lines: { bagger: 149.64, bust: 140.36 } });
    expect(html).toContain('Bagger $149.64 · Bust $140.36');
    expect(html).toContain('from the scoring path');
    // D-79 / D-78: neither of the two lines the seed proposed has a persisted
    // source, so neither ships. A guard, not a preference.
    expect(html).not.toContain('Stop $');
    expect(html).not.toContain('Alert line');
    expect(html).not.toContain('the agent&#x27;s rule');
  });

  it('MUTATION ROW — no lines means NO section, never an estimate or a placeholder', () => {
    const html = renderRow(HELD);
    expect(html).not.toContain('Bagger $');
    expect(html).not.toContain('from the scoring path');
    expect(html).not.toContain('Bust $');
  });

  it('the book panel has no lines — they are a fact about a piece', () => {
    const html = renderBook(HELD, { lines: { bagger: 149.64, bust: 140.36 } });
    expect(html).not.toContain('Bagger $');
  });
});

describe('Why? V2 — the sentences that name the piece (A2.1, D-75)', () => {
  const MULTI = {
    evalId: 'eval_040', timestamp: TS, decision: 'HOLD', downgraded: false,
    rationale: 'CF is the weakest name in the book and I am close to cutting it. SLB held its bid through the 12:45 bar, so the position stays as sized. MOS remains the hedge.',
  };

  it('MUTATION ROW — a row renders ONLY the sentences naming it; the full paragraph never lands on a row again', () => {
    const html = renderRow(MULTI);
    // The symbol is wrapped for emphasis, so the sentence is asserted around it.
    expect(html).toContain('<strong style="color:var(--ft-teal);font-weight:700">SLB</strong> held its bid through the 12:45 bar, so the position stays as sized.');
    expect(html).not.toContain('CF is the weakest name in the book');
    expect(html).not.toContain('MOS remains the hedge');
  });

  it('the sentences are VERBATIM — the same characters the decider wrote, with the piece emphasised', () => {
    const html = renderRow(MULTI);
    expect(html).toContain('held its bid through the 12:45 bar, so the position stays as sized.');
    expect(html).toContain('<strong style="color:var(--ft-teal);font-weight:700">SLB</strong>');
  });

  it('a check that spoke and never named this piece is a truthful state, not an empty panel', () => {
    const other = { ...MULTI, rationale: 'CF is the weakest name in the book. MOS remains the hedge.' };
    const html = renderRow(other);
    expect(html).toContain('Not named at the 12:47 PM check');
    expect(html).not.toContain('CF is the weakest name');
    // …and the way to the whole paragraph is still there.
    expect(renderRow(other, { onReadFullCheck: () => {} })).toContain('Read the full check');
  });

  it('a check with NO words says nothing about naming — the label already carries the tick', () => {
    const outage = { ...MULTI, rationale: 'Haiku call failed — defaulting to HOLD', haikuError: { failureClass: 'timeout' } };
    const html = renderRow(outage, { onReadFullCheck: () => {} });
    expect(html).not.toContain('Not named at the');
    // Nothing to read: no paragraph behind the door.
    expect(html).not.toContain('Read the full check');
  });

  it('`Read the full check` renders on a row only, and only with a handler', () => {
    expect(renderRow(MULTI, { onReadFullCheck: () => {} })).toContain('Read the full check');
    expect(renderRow(MULTI)).not.toContain('Read the full check');
    expect(renderBook(MULTI, { onReadFullCheck: () => {} })).not.toContain('Read the full check');
  });
});

describe('Why? V2 — `Woken by …` (A2.1, D-78)', () => {
  it('renders the ruled string for a persisted `price_drop` trigger, beneath the label', () => {
    const woken = { ...HELD, triggers: ['price_drop'] };
    const html = renderRow(woken);
    expect(html).toContain('Woken by a price drop');
    expect(html.indexOf('>Held<')).toBeLessThan(html.indexOf('Woken by a price drop'));
    // It is a trigger to EVALUATE, never a level or a rule (D-78).
    expect(html).not.toContain('ATR');
    expect(html).not.toContain('-0.5');
  });

  it('MUTATION ROW — an unruled or unknown trigger type renders NOTHING, never a raw type string', () => {
    for (const type of ['threshold_proximity', 'news_catalyst', 'forced_open', 'vwap_deviation', 'nr7_contraction', 'not_a_real_type']) {
      const html = renderRow({ ...HELD, triggers: [type] });
      expect(html).not.toContain('Woken by');
      expect(html).not.toContain(type);
    }
  });

  it('the first RULED type in the persisted order wins; no triggers renders nothing', () => {
    expect(renderRow({ ...HELD, triggers: ['forced_open', 'price_drop'] })).toContain('Woken by a price drop');
    expect(renderRow({ ...HELD, triggers: [] })).not.toContain('Woken by');
    expect(renderRow(HELD)).not.toContain('Woken by');
  });

  it('an outage tick still says why it ran — two true facts, not one over-claim', () => {
    const html = renderRow({ ...HELD, triggers: ['price_drop'], haikuError: { failureClass: 'timeout' } });
    expect(html).toContain('No decision recorded at this check · the evaluation timed out');
    expect(html).toContain('Woken by a price drop');
  });

  it('the book panel carries it too', () => {
    expect(renderBook({ ...HELD, triggers: ['price_drop'] })).toContain('Woken by a price drop');
  });
});

describe('Why? V2 — the plan at deploy (A2.1b, D-76)', () => {
  const PLAN = {
    activatedAt: '2026-09-01T13:30:00.000Z',
    brief: 'Energy is the only sector with a bid this week; semis are extended.',
    rationales: {
      star: 'SLB and DVN are the two cleanest energy breakouts on the board.',
      core: 'CF gives fertilizer exposure. MOS is the hedge.',
      support: null,
    },
  };
  const FOR_SLB = { tier: 'star', sentences: ['SLB and DVN are the two cleanest energy breakouts on the board.'] };

  it('a ROW carries its tier\'s sentences, labelled with the TIER and dated with the deploy', () => {
    const html = renderRow(HELD, { deployPlan: PLAN, deployPlanForSymbol: FOR_SLB });
    expect(html).toContain('At deploy · Star tier');
    expect(html).toContain('The plan at deploy · Sep 1');
    expect(html).toContain('are the two cleanest energy breakouts on the board.');
    // Never the brief on a row, and never another tier's words.
    expect(html).not.toContain('Energy is the only sector');
    expect(html).not.toContain('CF gives fertilizer exposure');
  });

  it('the BOOK panel carries the brief, dated, and no tier label', () => {
    const html = renderBook(HELD, { deployPlan: PLAN });
    expect(html).toContain('The plan at deploy · Sep 1');
    expect(html).toContain('Energy is the only sector with a bid this week');
    expect(html).not.toContain('At deploy ·');
  });

  it('MUTATION ROW — gated off, the section is absent whole: no label, no date, no placeholder', () => {
    // This is what a tournament battle or an algorithmic fallback renders
    // (selectDeployPlan returns null and the screen passes nothing).
    const row = renderRow(HELD);
    expect(row).not.toContain('At deploy');
    expect(row).not.toContain('The plan at deploy');
    const book = renderBook(HELD);
    expect(book).not.toContain('The plan at deploy');
  });

  it('a row whose tier rationale never names it renders no plan section at all', () => {
    const html = renderRow(HELD, { deployPlan: PLAN, deployPlanForSymbol: null });
    expect(html).not.toContain('At deploy');
    expect(html).not.toContain('The plan at deploy');
  });

  it('the plan never reads as a current decision — the check block keeps its own label above it', () => {
    const html = renderRow(HELD, { deployPlan: PLAN, deployPlanForSymbol: FOR_SLB });
    expect(html.indexOf('From the 12:47 PM check')).toBeLessThan(html.indexOf('At deploy · Star tier'));
    expect(html.indexOf('At deploy · Star tier')).toBeLessThan(html.indexOf('Entry $34.10'));
  });
});
