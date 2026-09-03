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
  MIN_RUN,
} from './buildTape';
import { WHY_KIND, isEngineAuthoredMotive, ENGINE_MOTIVE_PREFIXES, TEXT_DECIDES_SOURCES } from './selectWhyState';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { deriveReceipts } from './deriveReceipts';
import { slotLabel } from './deriveTurnLine';

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
    const r11status = { ...HAIKU_TRADE, source: 'guardrail', rationale: 'Guardrail override: stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.' };
    const r11fallback = { ...HAIKU_TRADE, source: 'guardrail', rationale: 'Deterministic guardrail enforcement during gameplan suppression (R11).' };
    const archetype = { ...HAIKU_TRADE, source: 'archetype', rationale: 'Risk manager: stagnation.' };
    expect(buildTradeEntries([RISK_TRADE], FEED)[0].motiveIsAgent).toBe(false);
    expect(buildTradeEntries([guardrail], FEED)[0].motiveIsAgent).toBe(false);
    expect(buildTradeEntries([r11status], FEED)[0].motiveIsAgent).toBe(false);
    expect(buildTradeEntries([r11fallback], FEED)[0].motiveIsAgent).toBe(false);
    expect(buildTradeEntries([archetype], FEED)[0].motiveIsAgent).toBe(false);
  });

  it('MUTATION ROW (review L1-F4) — a `reinforced_haiku` swap keeps THE AGENT\'S words, whatever `source` says', () => {
    // agentGuardrails.js ~468-497: the guardrail AGREES with a swap the model
    // argued for, leaves its rationale untouched, and returns a `guardrail_*`
    // sourceNote anyway — so the cron stamps `source: 'guardrail'`
    // (agent-evaluate.js ~2196-2236) over the model's own first-person prose.
    // `source` records who chose the EXIT; the footer names who wrote the
    // SENTENCE. Discriminating on `source` labelled the agent's argument as
    // the system's.
    const reinforced = {
      ...HAIKU_TRADE,
      source: 'guardrail',
      rationale: "I'm cutting GILD here — it lost the 50-day and my thesis was the breakout, not the bounce. MOS has the better setup into the close.",
    };
    expect(buildTradeEntries([reinforced], FEED)[0].motiveIsAgent).toBe(true);
    // …and this is why `guardrail` is one of the two sources where the TEXT
    // decides alone: the same source carries the cron's sentence on a FORCED
    // exit and the model's on a reinforced one.
    expect(buildTradeEntries([{ ...reinforced, rationale: 'Guardrail override (guardrail_stopLoss): forcing exit.' }], FEED)[0].motiveIsAgent).toBe(false);
  });

  it('MUTATION ROW (review FIX-1) — the GAMEPLAN rotation is the system\'s, and its template matches no prefix', () => {
    // agent-evaluate.js ~4056 composes `${sym} down ${pct}%, ${sym2} (${sector})
    // has tech score ${n}.` and the receipt carries `source: 'gameplan_meeting'`.
    // A text-only rule labelled this template `The agent's own words`.
    const gameplan = {
      ...HAIKU_TRADE,
      source: 'gameplan_meeting',
      rationale: 'MU down -8.3%, SLB (Energy) has tech score 71.',
    };
    expect(isEngineAuthoredMotive(gameplan.rationale)).toBe(false);
    expect(buildTradeEntries([gameplan], FEED)[0].motiveIsAgent).toBe(false);
  });

  it('MUTATION ROW (review FIX-1) — the UNKNOWN-source default is the system, not the agent', () => {
    // Under-crediting the agent is the smaller error under C1, and a source
    // added to the cron after today must land on the safe side by default.
    for (const source of ['something_new', 'risk_manager', 'archetype', 'gameplan_meeting']) {
      const trade = { ...HAIKU_TRADE, source, rationale: 'A sentence with no engine prefix at all.' };
      expect(buildTradeEntries([trade], FEED)[0].motiveIsAgent, source).toBe(false);
    }
    // The two sources under which the TEXT decides alone.
    expect(buildTradeEntries([{ ...HAIKU_TRADE, source: 'haiku' }], FEED)[0].motiveIsAgent).toBe(true);
    expect(buildTradeEntries([{ ...HAIKU_TRADE, source: 'guardrail' }], FEED)[0].motiveIsAgent).toBe(true);
    // …and with NO source at all (an evaluations[] entry) the text is the only
    // signal there is, so it is used alone.
    expect(isEngineAuthoredMotive('A sentence with no engine prefix at all.', null)).toBe(false);
    expect(isEngineAuthoredMotive('Risk manager: stopped out.', null)).toBe(true);
  });

  it('TRIPWIRE (review FIX-1) — the gameplan template and its source are the ones the cron still writes', () => {
    const cron = readFileSync(new URL('../../../api/cron/agent-evaluate.js', import.meta.url), 'utf8');
    expect(cron).toContain('has tech score ${topBenchCandidates[i].score}.');
    expect(cron).toContain("buildSwapReceiptSource({ source: 'gameplan_meeting'");
    expect(TEXT_DECIDES_SOURCES).toEqual(['haiku', 'guardrail']);
  });

  it('MUTATION ROW (review L1-F3) — the TEXT decides, so the check card and the trade card agree about one tick', () => {
    // A guardrail-forced swap that EXECUTED is not downgraded, so the check
    // card reaches selectWhyState's ordinary SWAP branch — which has no
    // `source` to read at all. One rule over the text is what keeps the two
    // cards from labelling the same sentence differently.
    const forcedRationale = 'Guardrail override (guardrail_stopLoss): Guardrail override: stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.';
    const [trade] = buildTradeEntries([{ ...HAIKU_TRADE, source: 'guardrail', rationale: forcedRationale }], FEED);
    const [check] = buildCheckEntries([{
      evalId: 'eval_009', timestamp: T('17:31'), decision: 'SWAP', downgraded: false,
      symbolOut: 'GILD', symbolIn: 'MOS', rationale: forcedRationale,
      guardrailSourceNote: 'guardrail_stopLoss',
      guardrailOverrides: [{ action: 'forced_exit', symbol: 'GILD', replacementSymbol: 'MOS' }],
    }], {}, []);
    expect(trade.motiveIsAgent).toBe(false);
    expect(check.footer).toBe('The system\'s reason');
    expect(isEngineAuthoredMotive(forcedRationale)).toBe(true);
  });

  it('TRIPWIRE — the ruling\'s SYSTEM rationale shapes are the ones the engine still writes', () => {
    // The discriminator is THE TEXT, exactly as ruling 5 describes it. These
    // rows pin each prefix to its writer: a reworded server string reds here
    // rather than silently re-attributing a sentence to the agent.
    const cron = readFileSync(new URL('../../../api/cron/agent-evaluate.js', import.meta.url), 'utf8');
    const guardrails = readFileSync(new URL('../../../api/_utils/agentGuardrails.js', import.meta.url), 'utf8');
    expect(cron).toContain('rationale: `Risk manager: ${riskResult.detail}`');
    expect(cron).toContain('rationale: `Guardrail override (${result.sourceNote || \'hard\'}): ${overrideNote}`');
    expect(cron).toContain('Deterministic guardrail enforcement during gameplan suppression (R11)');
    expect(guardrails).toContain('statusMessage: `Guardrail override: ');
    for (const prefix of ENGINE_MOTIVE_PREFIXES) {
      expect(isEngineAuthoredMotive(`${prefix} something`)).toBe(true);
    }
    // …and a model's own sentence that merely MENTIONS a guardrail is not one.
    expect(isEngineAuthoredMotive('The guardrail override would have fired, so I cut it myself.')).toBe(false);
    expect(isEngineAuthoredMotive(null)).toBe(false);
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

  it('a swap joins by SYMBOL PAIR when its feed entry carries evalId: null (hazard 35)', () => {
    const withDirective = FEED.map((e) => (e.evalId === null ? { ...e, directiveThreadId: 'dir_2' } : e));
    // The risk loop's own motive is engine-authored, so the echo is withheld
    // by the rule below whatever the join finds — use a model-authored swap
    // on the same pair to prove the JOIN works.
    const modelSwapOnRiskPair = { ...RISK_TRADE, evaluationId: null, source: 'haiku', rationale: 'Rotating CF into DVN on relative strength.' };
    expect(buildTradeEntries([modelSwapOnRiskPair], withDirective)[0].fromDirective).toBe(true);
    expect(buildTradeEntries([modelSwapOnRiskPair], FEED)[0].fromDirective).toBe(false);
  });

  it('MUTATION ROW (review L1-F5) — the echo is WITHHELD when the engine wrote the motive', () => {
    // On a guardrail-forced tick the feed's `swap` entry keeps the model's
    // PRE-override `directiveThreadId` while the pair is the guardrail's
    // (agent-evaluate.js ~2116-2124 preserves it through the rewrite), so the
    // echo would credit the user's directive with a swap it did not produce.
    // `↳ from directive` is D-51's `Acted` — it is a claim, not decoration.
    const forced = { ...HAIKU_TRADE, source: 'guardrail', rationale: 'Guardrail override (guardrail_stopLoss): forcing exit.' };
    expect(buildTradeEntries([forced], FEED)[0].fromDirective).toBe(false);
    // …and the model's own directive-driven swap still carries it.
    expect(buildTradeEntries([HAIKU_TRADE], FEED)[0].fromDirective).toBe(true);
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

  it('a run of quiet checks folds to one line, ORDERED at the first of them and stamped at none', () => {
    const folded = run(quietChecks(['14:00', '14:15', '14:30']));
    expect(folded).toHaveLength(1);
    expect(folded[0]._type).toBe(TAPE_KIND.CHECK_RUN);
    expect(folded[0].count).toBe(3);
    // The SORT POSITION is the first member's, which is what keeps the run
    // where its earliest check was.
    expect(folded[0].timestamp.toISOString()).toBe(T('14:00'));
    // …and there is no `at`. A run does not happen at an instant, nothing
    // renders a time for one, and the field it used to carry was the OLDEST
    // check's — the one that got stamped onto the peek line and made the
    // strip's two lines disagree (review L1-F4, removed at RA-F10). A field
    // meaning "the run's time" is a defect waiting to be re-read.
    expect(folded[0].at).toBeUndefined();
    expect('at' in folded[0]).toBe(false);
  });

  it('THE PINNED CARD IS NEVER FOLDED — at any position in the run (D-89)', () => {
    // `Read the full check` opens a named check's card, and a HOLD with words
    // is `quiet` by D-77's conjuncts — so the ordinary target of that door is
    // the ordinary member of a run. Excluding it from `joins` alone was NOT
    // enough: the `else` branch puts a quiet check into a NEW run rather than
    // letting it stand alone, so the pinned card was swallowed again by the
    // very next member. It rendered only when it happened to be the LAST check
    // in the document — which is the shape the first fixture had, so the
    // mounted row passed while two of the three positions were broken.
    const items = quietChecks(['14:00', '14:15', '14:30']);
    const idOf = (i) => items[i].id;
    const kinds = (out) => out.map((o) => [o._type, o.id, o.count ?? null]);

    // FIRST: it stands alone and the two behind it still fold.
    expect(kinds(collapseQuietChecks(items, idOf(0)))).toEqual([
      [TAPE_KIND.CHECK, idOf(0), null],
      [TAPE_KIND.CHECK_RUN, `tape-run-${idOf(1)}`, 2],
    ]);

    // LAST: the two in front of it fold and it stands alone.
    expect(kinds(collapseQuietChecks(items, idOf(2)))).toEqual([
      [TAPE_KIND.CHECK_RUN, `tape-run-${idOf(0)}`, 2],
      [TAPE_KIND.CHECK, idOf(2), null],
    ]);

    // MIDDLE: it breaks contiguity, so each fragment is a run of ONE and the
    // existing rule leaves those as the cards they are. A `2 checks · no
    // change` line that skipped over an expanded card in its middle would be
    // lying about the contiguous slice it stands for.
    expect(kinds(collapseQuietChecks(items, idOf(1)))).toEqual([
      [TAPE_KIND.CHECK, idOf(0), null],
      [TAPE_KIND.CHECK, idOf(1), null],
      [TAPE_KIND.CHECK, idOf(2), null],
    ]);

    // An id that names nothing in the stream changes nothing at all.
    expect(kinds(collapseQuietChecks(items, 'tape-check-not-here'))).toEqual([
      [TAPE_KIND.CHECK_RUN, `tape-run-${idOf(0)}`, 3],
    ]);
    // …and so does no pin, which is every caller but the door.
    expect(kinds(collapseQuietChecks(items))).toEqual([
      [TAPE_KIND.CHECK_RUN, `tape-run-${idOf(0)}`, 3],
    ]);
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

  it('MUTATION ROW (D-77 disposition) — a directive filed between two checks breaks the run', () => {
    // THIS is the guard for the disposition conjunct. A mounted render cannot
    // be (review FIX-5): a directive filing IS a chat exchange, so in the
    // merged stream it is a MESSAGE between the two checks and breaks their
    // adjacency by itself, whatever the run key says. The conjunct is
    // observable only here, at the level where the key is composed.
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

  it('the run key carries the RECEIPT STATE as well as the thread (D-77 "receipts unchanged")', () => {
    // Review L4-F3: the state half is near-inert in practice — a state change
    // with the SAME current thread means a completion (`expired`), which lands
    // on every check at once. It is composed anyway so D-77's wording is
    // literally true, and this row pins the composition so it is not silently
    // dropped to the thread id alone.
    const exchanges = [{ timestamp: T('13:50'), directiveThreadId: 'dir_1' }];
    const filed = deriveReceipts(exchanges, { directiveThreadId: 'dir_1' }, 'active');
    const expired = deriveReceipts(exchanges, { directiveThreadId: 'dir_1' }, 'completed');
    expect(filed.dir_1.state).toBe('filed');
    expect(expired.dir_1.state).toBe('expired');
    const keyUnder = (receipts) => buildCheckEntries([check('14:00')], receipts, exchanges)[0].runKey;
    expect(keyUnder(filed)).toContain('dir_1:filed');
    expect(keyUnder(expired)).toContain('dir_1:expired');
    expect(keyUnder(filed)).not.toBe(keyUnder(expired));
    // …and with no directive and no ruled trigger the key is the banked score
    // and two empty fields — banked | disposition | the rendered `Woken by`.
    expect(buildCheckEntries([check('14:00')], {}, [])[0].runKey).toBe('40||');
    expect(buildCheckEntries([check('14:00', { triggers: ['price_drop'] })], {}, [])[0].runKey)
      .toBe('40||Woken by a price drop');
  });

  it('MUTATION ROW (review L1-F6) — two quiet checks whose CARDS would differ never become one line', () => {
    // Every entry carries a trigger (the cron writes one only when
    // `shouldEvaluate` is true), and since D-81 all nine persisted types have
    // their own sentence — so adjacent quiet checks differ in what their cards
    // render whenever the gate woke them for different reasons, which is the
    // normal case rather than an edge one. Collapsing them deleted a line the
    // player was shown, while every D-77 data conjunct agreed.
    const items = buildCheckEntries([
      check('14:00', { triggers: ['price_drop'] }),
      check('14:15', { triggers: ['news_catalyst'] }),
    ], {}, []);
    expect(COPY.wokenBy(items[0].triggers)).toBe('Woken by a price drop');
    expect(COPY.wokenBy(items[1].triggers)).toBe('Woken by a news story on a piece');
    expect(run(items).map((f) => f._type)).toEqual([TAPE_KIND.CHECK, TAPE_KIND.CHECK]);
    // …and two checks that WOULD render the same line still fold.
    const same = buildCheckEntries([
      check('14:00', { triggers: ['price_drop'] }),
      check('14:15', { triggers: ['price_drop'] }),
    ], {}, []);
    expect(run(same)).toHaveLength(1);
    expect(run(same)[0].count).toBe(2);
    // Two UNKNOWN types both render nothing, so they are the same line too —
    // the key is the RENDERED STRING, not the raw type.
    const bothSilent = buildCheckEntries([
      check('14:00', { triggers: ['earnings_gap'] }),
      check('14:15', { triggers: ['sector_rotation'] }),
    ], {}, []);
    expect(COPY.wokenBy(['earnings_gap'])).toBeNull();
    expect(COPY.wokenBy(['sector_rotation'])).toBeNull();
    expect(run(bothSilent)).toHaveLength(1);
  });

  it('a scoring-tier crossing still folds — the LIVE score is D-77\'s stated exclusion, not an oversight', () => {
    // Refuter A REFUTED the claim that this is a defect: `scores.active` moves
    // with price on nearly every tick and the board already shows it, which is
    // the same reason D-77 excludes the live total. Pinned so the exclusion is
    // a decision on the record rather than an accident.
    const items = buildCheckEntries([
      check('14:00', { scores: { active: 1, banked: 40, total: 41 } }),
      check('14:15', { scores: { active: 14.5, banked: 40, total: 54.5 } }),
    ], {}, []);
    expect(run(items)).toHaveLength(1);
    expect(run(items)[0].count).toBe(2);
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

describe('ruling 9 — every other feed action renders NOTHING (hazards 32, 33)', () => {
  it('MUTATION ROW — a feed full of non-swap actions produces no tape entry at all', () => {
    // The guarantee held only because `buildTape` never reads `entry.action`
    // (review L5-F4) — nothing named it, so a change that re-read the feed
    // would have tripped no row. These are the actions the Phase 0 report
    // enumerates as the ones that must render nothing.
    const noise = [
      { timestamp: T('14:00'), action: 'hold', evalId: 'eval_1400', message: 'Holding the book.' },
      { timestamp: T('14:15'), action: 'trade_narration', message: 'Agent explained the latest trade.' },
      { timestamp: T('14:30'), action: 'first_message', message: 'Deployed.' },
      { timestamp: T('14:45'), action: 'eval_degraded', message: 'Evaluation engine degraded this tick (timeout).' },
      { timestamp: T('15:00'), action: 'guardrail_block', message: 'Guardrail blocked the swap.' },
      { timestamp: T('15:15'), action: 'watchlist_refresh', message: 'Watchlist refreshed.' },
      { timestamp: T('15:30'), action: 'guardrail_forced_swap', symbolOut: 'MU', symbolIn: 'NVDA', message: 'Forcing exit.' },
    ];
    expect(buildTape({ trades: [], statusFeed: noise, evaluations: [], receipts: {}, chatExchanges: [] })).toEqual([]);
  });

  it('a `hold` feed entry never becomes a second card for a tick the CHECK card owns (hazard 33)', () => {
    const held = check('14:00');
    const holdLine = [{ timestamp: T('14:00'), action: 'hold', evalId: held.evalId, message: 'Holding the book.' }];
    const entries = buildTape({ trades: [], statusFeed: holdLine, evaluations: [held], receipts: {}, chatExchanges: [] });
    expect(entries).toHaveLength(1);
    expect(entries[0]._type).toBe(TAPE_KIND.CHECK);
    expect(JSON.stringify(entries)).not.toContain('Holding the book.');
  });

  it('a `trade_narration` feed TWIN never becomes a second trade (hazard 32)', () => {
    // The narration's own exchange stays a message; its feed twin renders
    // nothing, so one swap is never two events on the tape.
    const twin = [
      FEED[0],
      { timestamp: T('17:32'), action: 'trade_narration', symbolOut: 'GILD', symbolIn: 'MOS', message: 'Agent explained the latest trade.' },
    ];
    const entries = buildTradeEntries([HAIKU_TRADE], twin);
    expect(entries).toHaveLength(1);
    expect(JSON.stringify(entries)).not.toContain('explained');
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

describe('a check is named by its SLOT, a trade by its instant (D-83)', () => {
  const TS = (hhmmss) => `2026-09-01T${hhmmss}.000Z`;

  it('the check card and the Why? panel name ONE tick the same, from two different fields', () => {
    // The founder's A2.2 smoke, end to end: the entry landed at 12:31:07 and
    // the scoring stamp at 12:30:02, two `new Date()` calls in one cron run.
    // Before D-83 the card said `At the 12:31 PM check` and the header said
    // `Checked 12:30 PM`.
    const entry = { ...check('16:31'), timestamp: TS('16:31:07') };
    const [card] = buildCheckEntries([entry], {}, []);
    expect(COPY.checkCardLabel(card.at, card.label)).toBe('Status check · 12:30 PM · Held');
    expect(COPY.atCheck(TS('16:30:02'))).toBe('At the 12:30 PM check');
    expect(COPY.fromCheck(TS('16:30:02'))).toBe('From the 12:30 PM check');
    // …and the ordering key is still the exact instant.
    expect(card.at).toBe(TS('16:31:07'));
    expect(card.timestamp.getTime()).toBe(new Date(TS('16:31:07')).getTime());
  });

  it('a 12:44:59 entry is still the 12:30 check', () => {
    const [card] = buildCheckEntries([{ ...check('16:44'), timestamp: TS('16:44:59') }], {}, []);
    expect(COPY.checkCardLabel(card.at, card.label)).toBe('Status check · 12:30 PM · Held');
  });

  it('the collapsed run ORDERS on the first check\'s exact instant and names no time at all', () => {
    // `{n} checks · no change` stands for a contiguous slice, and the slice's
    // position in the stream is the exact instant of the check it opens with
    // — never a floored one, or two runs inside one slot would tie.
    const entries = buildCheckEntries(
      [{ ...check('16:30'), timestamp: TS('16:30:02') }, { ...check('16:45'), timestamp: TS('16:45:11') }],
      {}, [],
    );
    const [run] = collapseQuietChecks(entries);
    expect(run._type).toBe(TAPE_KIND.CHECK_RUN);
    expect(run.count).toBe(2);
    expect(run.timestamp.toISOString()).toBe(TS('16:30:02'));
    expect(slotLabel(run.timestamp)).toBe('12:30 PM');
    // The run itself names NO time — not its first check's slot, not its
    // last's. The card renders the count alone and so does the peek line.
    expect(run.at).toBeUndefined();
  });

  it('a TRADE keeps its exact minute — a swap executes at an instant, not at a slot', () => {
    const [trade] = buildTradeEntries([{ ...HAIKU_TRADE, swappedOutAt: TS('17:31:07') }], FEED);
    expect(COPY.tradeCardLine(trade.at, trade.symbolOut, trade.symbolIn, trade.tier))
      .toBe('1:31 PM · GILD → MOS · Core');
    expect(COPY.tradeLine(trade.at, trade.symbolOut, trade.symbolIn)).toBe('1:31 PM · GILD → MOS');
  });

  it('MUTATION ROW — the run key is unaffected by the slot label', () => {
    // Two quiet checks in the SAME slot (a cron retry) still fold on their
    // data conjuncts, and two in different slots still fold: the slot is a
    // label, never a conjunct of D-77.
    const sameSlot = collapseQuietChecks(buildCheckEntries(
      [{ ...check('16:30'), timestamp: TS('16:30:02') }, { ...check('16:31'), timestamp: TS('16:31:44') }],
      {}, [],
    ));
    expect(sameSlot).toHaveLength(1);
    expect(sameSlot[0].count).toBe(2);
  });
});
