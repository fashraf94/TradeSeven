// src/screens/battleView/buildTape.test.js
//
// A2.2 (D-72, D-77) — the tape. Four things this file exists to hold:
//
//   1. The spine is `trades[]`, so all five swap actions appear and a
//      guardrail-forced swap that never executed gets no card (hazards 25, 26).
//   2. Nothing on the DO-NOT list can reach a card (hazard 29, D-64) — asserted
//      on the built entry, not on a render, so a future card component cannot
//      surface a field the builder was never supposed to carry.
//   3. The motive's AUTHOR is the persisted `source`, and the three system
//      rationale shapes the ruling names all arrive with a non-agent source
//      (a tripwire reads the cron to prove it).
//   4. Every conjunct of the "no change" rule breaks a run (D-77), and the
//      live `total` does not.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildTape,
  buildTradeEntries,
  buildCheckEntries,
  collapseQuietChecks,
  TAPE_KIND,
  AGENT_TRADE_SOURCE,
  MIN_RUN,
} from './buildTape';
import { WHY_KIND } from './selectWhyState';
import { deriveReceipts } from './deriveReceipts';

const T = (hhmm) => `2026-09-01T${hhmm}:00.000Z`;

const HAIKU_TRADE = {
  symbolOut: 'GILD', symbolIn: 'MOS', tier: 'core',
  lockedPoints: 8.04, lockedGainPct: 2.1,
  swappedOutAt: T('17:31'),
  evaluationId: 'eval_009',
  rationale: 'GILD has stalled at the 200-day and MOS is breaking out on volume; rotating the core slot into the stronger name.',
  source: 'haiku',
  // Fields a card must NEVER render — present on the real record.
  hypothesis: 'Hypothesis: MOS continues into the close.',
  conviction: 78,
  exitReason: 'haiku_decision',
  entryRegime: 'risk_on',
  snapshot: { rsi: 61 },
  trade_reasoning: { indicators: ['rsi', 'vwap'] },
};

const RISK_TRADE = {
  symbolOut: 'CF', symbolIn: 'DVN', tier: 'support',
  lockedPoints: -3.2,
  swappedOutAt: T('18:02'),
  evaluationId: 'risk_stop_loss_CF_1756742520000',
  rationale: 'Risk manager: CF broke the trailing stop at -1.5x ATR.',
  source: 'risk_manager',
};

const FEED = [
  {
    timestamp: T('17:31'), action: 'swap', evalId: 'eval_009',
    symbolOut: 'GILD', symbolIn: 'MOS',
    message: 'Rotated the core slot.', directiveThreadId: 'dir_1', source: 'haiku',
  },
  {
    timestamp: T('18:02'), action: 'trail_stop', evalId: null,
    symbolOut: 'CF', symbolIn: 'DVN',
    message: 'Risk: CF broke the trailing stop.', source: 'risk_manager',
  },
];

const check = (hhmm, over = {}) => ({
  evalId: `eval_${hhmm.replace(':', '')}`,
  timestamp: T(hhmm),
  decision: 'HOLD',
  downgraded: false,
  rationale: 'The book is holding its shape. Nothing in the tape argues for a rotation yet.',
  scores: { active: 12, banked: 40, total: 52 },
  ...over,
});

describe('trade cards — the spine is trades[], not the feed', () => {
  it('a card per EXECUTED swap, with the tier, the banked points and the motive', () => {
    const [entry] = buildTradeEntries([HAIKU_TRADE], FEED);
    expect(entry._type).toBe(TAPE_KIND.TRADE);
    expect(entry.symbolOut).toBe('GILD');
    expect(entry.symbolIn).toBe('MOS');
    expect(entry.tier).toBe('core');
    expect(entry.lockedPoints).toBe(8.04);
    expect(entry.motive).toBe(HAIKU_TRADE.rationale);
    expect(entry.timestamp.toISOString()).toBe(T('17:31'));
  });

  it('MUTATION ROW — every swap ACTION appears, not the three the shipped filter kept', () => {
    // `swap_out`, `trail_stop` and every guardrail exit were invisible in the
    // shipped chat because it filtered the FEED (hazard 26). The trade record
    // does not carry an action at all — being in trades[] IS the qualification.
    const entries = buildTradeEntries([HAIKU_TRADE, RISK_TRADE], FEED);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.symbolOut)).toEqual(['GILD', 'CF']);
  });

  it('MUTATION ROW — a guardrail-forced swap that never executed gets NO card (hazard 25)', () => {
    // The feed announces `guardrail_forced_swap` before the outcome is known.
    // With no trade record there is no swap, so there is no card.
    const announced = [{
      timestamp: T('19:10'), action: 'guardrail_forced_swap', evalId: 'eval_040',
      symbolOut: 'MU', symbolIn: 'NVDA', message: 'Forcing exit MU → NVDA.', source: 'guardrail',
    }];
    expect(buildTradeEntries([], announced)).toEqual([]);
    expect(buildTradeEntries([HAIKU_TRADE], [...FEED, ...announced])).toHaveLength(1);
  });

  it('MUTATION ROW — nothing on the DO-NOT list rides the entry (hazard 29, D-64)', () => {
    const [entry] = buildTradeEntries([HAIKU_TRADE], FEED);
    for (const forbidden of [
      'pvpContext', 'hypothesis', 'conviction', 'trade_reasoning', 'citedRules',
      'citedForgeRules', 'regime', 'entryRegime', 'exitReason', 'source',
      'triggeredBy', 'snapshot', 'message',
    ]) {
      expect(entry).not.toHaveProperty(forbidden);
    }
    expect(JSON.stringify(entry)).not.toContain('haiku_decision');
    expect(JSON.stringify(entry)).not.toContain('Hypothesis');
  });

  it('a trade with no usable timestamp is skipped rather than sorted to the epoch', () => {
    expect(buildTradeEntries([{ ...HAIKU_TRADE, swappedOutAt: null }], FEED)).toEqual([]);
    expect(buildTradeEntries([null, undefined, 'x'], FEED)).toEqual([]);
    expect(buildTradeEntries(null, FEED)).toEqual([]);
  });
});

describe('the motive and its author (ruling 5)', () => {
  it('the model\'s own swap is the AGENT\'s words', () => {
    expect(buildTradeEntries([HAIKU_TRADE], FEED)[0].motiveIsAgent).toBe(true);
  });

  it('MUTATION ROW — the risk loop, the guardrail path and R11 are the SYSTEM\'s', () => {
    const guardrail = { ...HAIKU_TRADE, source: 'guardrail', rationale: 'Guardrail override (guardrail_stopLoss): forcing exit.' };
    const r11 = { ...HAIKU_TRADE, source: 'guardrail', rationale: 'Deterministic guardrail enforcement during gameplan suppression (R11).' };
    const archetype = { ...HAIKU_TRADE, source: 'archetype', rationale: 'Risk manager: stagnation.' };
    expect(buildTradeEntries([RISK_TRADE], FEED)[0].motiveIsAgent).toBe(false);
    expect(buildTradeEntries([guardrail], FEED)[0].motiveIsAgent).toBe(false);
    expect(buildTradeEntries([r11], FEED)[0].motiveIsAgent).toBe(false);
    expect(buildTradeEntries([archetype], FEED)[0].motiveIsAgent).toBe(false);
    // An unknown or missing source defaults to the SYSTEM — under-crediting
    // the agent is the safe direction under C1.
    expect(buildTradeEntries([{ ...HAIKU_TRADE, source: undefined }], FEED)[0].motiveIsAgent).toBe(false);
    expect(buildTradeEntries([{ ...HAIKU_TRADE, source: 'something_new' }], FEED)[0].motiveIsAgent).toBe(false);
  });

  it('TRIPWIRE — the ruling\'s three SYSTEM rationale shapes all carry a non-agent source in the cron', () => {
    // The discriminator is `source`, read once (BUILD_RULES §9). This row
    // proves it agrees with the ruling's description of the three cases, so
    // the two can never be argued to have drifted apart.
    const cron = readFileSync(new URL('../../../api/cron/agent-evaluate.js', import.meta.url), 'utf8');
    expect(cron).toContain('rationale: `Risk manager: ${riskResult.detail}`');
    expect(cron).toContain("source: riskResult.reason === 'stagnation' ? 'archetype' : 'risk_manager'");
    expect(cron).toContain('rationale: `Guardrail override (${result.sourceNote || \'hard\'}): ${overrideNote}`');
    expect(cron).toContain("const swapSource = haikuSwapReason === 'haiku_decision' ? 'haiku' : 'guardrail'");
    expect(cron).toContain("Deterministic guardrail enforcement during gameplan suppression (R11)");
    expect(AGENT_TRADE_SOURCE).toBe('haiku');
  });

  it('`message` is never the motive (hazard 24)', () => {
    // The feed's message is the optional status_feed_update; on a
    // guardrail-forced swap it is the model's PRE-override line.
    const [entry] = buildTradeEntries([HAIKU_TRADE], FEED);
    expect(entry.motive).not.toBe('Rotated the core slot.');
    expect(entry.motive).toBe(HAIKU_TRADE.rationale);
  });
});

describe('the directive echo — joined from the feed', () => {
  it('joins on evaluationId first', () => {
    expect(buildTradeEntries([HAIKU_TRADE], FEED)[0].fromDirective).toBe(true);
  });

  it('a risk-loop swap joins by SYMBOL PAIR — its feed entry carries evalId: null (hazard 35)', () => {
    const withDirective = FEED.map((e) => (e.evalId === null ? { ...e, directiveThreadId: 'dir_2' } : e));
    expect(buildTradeEntries([RISK_TRADE], withDirective)[0].fromDirective).toBe(true);
    expect(buildTradeEntries([RISK_TRADE], FEED)[0].fromDirective).toBe(false);
  });

  it('MUTATION ROW — among repeated pairs the NEAREST entry in time wins, not the last written', () => {
    // The shipped map was last-wins, so a second GILD → MOS rotation borrowed
    // the first one's directive echo.
    const first = { timestamp: T('17:31'), action: 'swap', evalId: null, symbolOut: 'GILD', symbolIn: 'MOS', directiveThreadId: 'dir_1' };
    const second = { timestamp: T('19:45'), action: 'swap', evalId: null, symbolOut: 'GILD', symbolIn: 'MOS' };
    const early = { ...HAIKU_TRADE, evaluationId: null, swappedOutAt: T('17:31') };
    const late = { ...HAIKU_TRADE, evaluationId: null, swappedOutAt: T('19:45') };
    expect(buildTradeEntries([early], [first, second])[0].fromDirective).toBe(true);
    expect(buildTradeEntries([late], [first, second])[0].fromDirective).toBe(false);
  });

  it('no feed at all is not an error — the card simply carries no echo', () => {
    expect(buildTradeEntries([HAIKU_TRADE], null)[0].fromDirective).toBe(false);
    expect(buildTradeEntries([HAIKU_TRADE], [])[0].fromDirective).toBe(false);
  });
});

describe('check cards — the SAME five-state selector the panel renders from', () => {
  it('one card per decided check, with the tick\'s label and its first sentence', () => {
    const [entry] = buildCheckEntries([check('17:46')], {}, []);
    expect(entry._type).toBe(TAPE_KIND.CHECK);
    expect(entry.kind).toBe(WHY_KIND.HELD);
    expect(entry.label).toBe('Held');
    expect(entry.firstSentence).toBe('The book is holding its shape.');
    expect(entry.rationale).toContain('Nothing in the tape argues for a rotation yet.');
  });

  it('MUTATION ROW — a HISTORICAL entry is not treated as a stale absence', () => {
    // selectWhyState's `>=` join exists to tell the LATEST check from a stale
    // one. Every entry on the tape is the latest check of its own moment, so
    // it is called with its OWN timestamp — calling it with the battle's
    // lastScoredAt would turn every card but the newest into `No decision`.
    const entries = buildCheckEntries([check('14:00'), check('17:46')], {}, []);
    expect(entries.map((e) => e.kind)).toEqual([WHY_KIND.HELD, WHY_KIND.HELD]);
    expect(entries.every((e) => e.label === 'Held')).toBe(true);
  });

  it('a downgraded, failed, guardrail-forced or outage check carries the panel\'s labels', () => {
    const kinds = buildCheckEntries([
      check('14:00', { downgraded: true }),
      check('14:15', { downgraded: true, validationErrors: ['Swap execution failed: x'] }),
      check('14:30', { downgraded: true, guardrailSourceNote: 'guardrail_stopLoss', guardrailOverrides: [{ action: 'forced_exit', symbol: 'CF', replacementSymbol: 'DVN' }] }),
      check('14:45', { haikuError: { failureClass: 'budget_skipped' } }),
      check('15:00', { decision: 'SWAP', symbolOut: 'GILD', symbolIn: 'MOS' }),
    ], {}, []).map((e) => e.kind);
    expect(kinds).toEqual([
      WHY_KIND.DOWNGRADED, WHY_KIND.FAILED, WHY_KIND.GUARDRAIL_FAILED, WHY_KIND.ABSENT, WHY_KIND.SWAPPED,
    ]);
  });

  it('carries the persisted trigger types so the card can say why the tick ran', () => {
    const [entry] = buildCheckEntries([check('17:46', { triggers: ['price_drop'] })], {}, []);
    expect(entry.triggers).toEqual(['price_drop']);
  });

  it('an entry with no usable timestamp is skipped', () => {
    expect(buildCheckEntries([{ ...check('17:46'), timestamp: null }], {}, [])).toEqual([]);
    expect(buildCheckEntries(null, {}, [])).toEqual([]);
  });
});

describe('`N checks · no change` — every conjunct of D-77', () => {
  const run = (entries) => collapseQuietChecks(entries);
  const quietChecks = (times, over = {}) => buildCheckEntries(times.map((t) => check(t, over)), {}, []);

  it('a run of quiet checks folds to one line, stamped at the FIRST of them', () => {
    const folded = run(quietChecks(['14:00', '14:15', '14:30']));
    expect(folded).toHaveLength(1);
    expect(folded[0]._type).toBe(TAPE_KIND.CHECK_RUN);
    expect(folded[0].count).toBe(3);
    expect(folded[0].at).toBe(T('14:00'));
  });

  it('a run of ONE is left as the card it is', () => {
    const folded = run(quietChecks(['14:00']));
    expect(folded).toHaveLength(1);
    expect(folded[0]._type).toBe(TAPE_KIND.CHECK);
    expect(MIN_RUN).toBe(2);
  });

  it('MUTATION ROW — a SWAP check breaks the run and keeps its own card', () => {
    const items = buildCheckEntries([
      check('14:00'), check('14:15', { decision: 'SWAP', symbolOut: 'GILD', symbolIn: 'MOS' }), check('14:30'), check('14:45'),
    ], {}, []);
    const folded = run(items);
    expect(folded.map((f) => f._type)).toEqual([TAPE_KIND.CHECK, TAPE_KIND.CHECK, TAPE_KIND.CHECK_RUN]);
    expect(folded[2].count).toBe(2);
  });

  it('MUTATION ROW — a downgrade and an outage each break the run', () => {
    for (const over of [{ downgraded: true }, { haikuError: { failureClass: 'timeout' } }]) {
      const items = buildCheckEntries([check('14:00'), check('14:15', over), check('14:30')], {}, []);
      const folded = run(items);
      expect(folded.map((f) => f._type)).toEqual([TAPE_KIND.CHECK, TAPE_KIND.CHECK, TAPE_KIND.CHECK]);
    }
  });

  it('MUTATION ROW — a change in `scores.banked` breaks the run', () => {
    const items = buildCheckEntries([
      check('14:00'), check('14:15'), check('14:30', { scores: { active: 9, banked: 48, total: 57 } }), check('14:45', { scores: { active: 9, banked: 48, total: 57 } }),
    ], {}, []);
    const folded = run(items);
    expect(folded.map((f) => f._type)).toEqual([TAPE_KIND.CHECK_RUN, TAPE_KIND.CHECK_RUN]);
    expect(folded.map((f) => f.count)).toEqual([2, 2]);
  });

  it('MUTATION ROW — the live `total` does NOT break a run: it moves with price every tick', () => {
    const items = buildCheckEntries([
      check('14:00', { scores: { active: 12, banked: 40, total: 52 } }),
      check('14:15', { scores: { active: 13, banked: 40, total: 53 } }),
      check('14:30', { scores: { active: 11, banked: 40, total: 51 } }),
    ], {}, []);
    expect(run(items)).toHaveLength(1);
    expect(run(items)[0].count).toBe(3);
  });

  it('MUTATION ROW — a directive filed between two checks breaks the run (the receipts change)', () => {
    const exchanges = [
      { timestamp: T('13:50'), directiveThreadId: 'dir_1' },
      { timestamp: T('14:20'), directiveThreadId: 'dir_2' },
    ];
    const receipts = deriveReceipts(exchanges, { directiveThreadId: 'dir_2' }, 'active');
    const items = buildCheckEntries([check('14:00'), check('14:15'), check('14:30'), check('14:45')], receipts, exchanges);
    const folded = run(items);
    expect(folded.map((f) => f._type)).toEqual([TAPE_KIND.CHECK_RUN, TAPE_KIND.CHECK_RUN]);
    expect(folded.map((f) => f.count)).toEqual([2, 2]);
    // …and with no filing between them the same four checks are one run.
    const quiet = buildCheckEntries([check('14:00'), check('14:15'), check('14:30'), check('14:45')], receipts, [exchanges[0]]);
    expect(run(quiet)).toHaveLength(1);
    expect(run(quiet)[0].count).toBe(4);
  });

  it('MUTATION ROW — a TRADE between two quiet checks breaks the run: the position set changed', () => {
    // This is what makes "positions unchanged" true by construction — every
    // executed swap is a card in this same stream, so it breaks adjacency.
    const checks = buildCheckEntries([check('14:00'), check('14:15'), check('14:30')], {}, []);
    const trade = buildTradeEntries([{ ...HAIKU_TRADE, swappedOutAt: T('14:20') }], FEED);
    const merged = [...checks, ...trade].sort((a, b) => a.timestamp - b.timestamp);
    const folded = run(merged);
    expect(folded.map((f) => f._type)).toEqual([TAPE_KIND.CHECK_RUN, TAPE_KIND.TRADE, TAPE_KIND.CHECK]);
    expect(folded[0].count).toBe(2);
  });

  it('a MESSAGE between two quiet checks breaks the run too — a collapsed line may only stand for adjacent entries', () => {
    const checks = buildCheckEntries([check('14:00'), check('14:15'), check('14:30')], {}, []);
    const message = { _type: 'message', id: 'm1', timestamp: new Date(T('14:20')) };
    const merged = [...checks, message].sort((a, b) => a.timestamp - b.timestamp);
    const folded = run(merged);
    expect(folded.map((f) => f._type)).toEqual([TAPE_KIND.CHECK_RUN, 'message', TAPE_KIND.CHECK]);
  });

  it('non-check items pass through untouched, and the empty cases are empty', () => {
    const message = { _type: 'message', id: 'm1', timestamp: new Date(T('14:20')) };
    expect(run([message])).toEqual([message]);
    expect(run([])).toEqual([]);
    expect(run(null)).toEqual([]);
  });
});

describe('buildTape — one array, both kinds', () => {
  it('returns the trade cards and the check cards together, unsorted', () => {
    const entries = buildTape({
      trades: [HAIKU_TRADE, RISK_TRADE],
      statusFeed: FEED,
      evaluations: [check('17:46')],
      receipts: {},
      chatExchanges: [],
    });
    expect(entries.filter((e) => e._type === TAPE_KIND.TRADE)).toHaveLength(2);
    expect(entries.filter((e) => e._type === TAPE_KIND.CHECK)).toHaveLength(1);
  });

  it('an empty document is an empty tape, never a crash', () => {
    expect(buildTape({})).toEqual([]);
    expect(buildTape({ trades: null, statusFeed: null, evaluations: null, receipts: null, chatExchanges: null })).toEqual([]);
  });

  it('every entry carries a Date and a stable id, so one sort orders the whole stream', () => {
    const entries = buildTape({
      trades: [HAIKU_TRADE], statusFeed: FEED, evaluations: [check('17:46')], receipts: {}, chatExchanges: [],
    });
    for (const entry of entries) {
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(Number.isNaN(entry.timestamp.getTime())).toBe(false);
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
    }
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
