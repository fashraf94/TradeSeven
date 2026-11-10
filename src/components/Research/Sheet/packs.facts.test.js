// Research Modal Build C — THE FACTS, PINNED (review C3, A1, A5, A11, A13).
//
// packs.test.js pins the order and the kinds; this file pins the WORDS AND
// NUMBERS every item prints, so a template that measures from the wrong base
// (the gap from entry, the drawdown over the live price, the next check at
// "now", atrX as a percent, the rung compare from entry …) fails here.
//
// The golden (__goldens__/packs.facts.golden.json) is every candidate item of
// every archetype on the shared fixture — kind, fact, source label, status —
// written by GENERATE_SHEET_FACTS_GOLDEN=1 from a build whose facts were read
// and checked line by line (the build report's six-archetype table). The rows
// below it hold the cases the fixture cannot tell apart, each with numbers
// worked by hand.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { measuredSheetBattle, SHEET_NOW, ARCHETYPES, AAPL_DAILY, RANKINGS } from './__fixtures__/sheetBattles.js';
import { candidateItems, buildPacks, holdingOf } from './packs.js';
import { toGo } from '../BombMode/ladder.js';
import { RISK_WORDS, RISK_REASON_WORDS } from './sheetCopy.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, '__goldens__', 'packs.facts.golden.json');
const GENERATE = process.env.GENERATE_SHEET_FACTS_GOLDEN === '1';

const ROW = { positionId: 'position-agent' };
const STANDING = { player: 62, opponent: 68, digits: 0, you: '+62', them: '+68', lead: 'cpu' };
const args = (battle, over = {}) => ({ battle, symbol: 'AAPL', nowMs: SHEET_NOW, row: ROW, live: 103.2, dailyBars: AAPL_DAILY, rankings: RANKINGS, standing: STANDING, directive: battle.directive, incumbent: 'ETH', battleId: 'stock-battle', ...over });
const items = (battle, over) => candidateItems(args(battle, over)).items;
const factOf = (list, kind) => list.find((i) => i.kind === kind)?.fact;
const clone = (b) => JSON.parse(JSON.stringify(b));

const BATTLES = {};
beforeAll(async () => {
  for (const a of ARCHETYPES) BATTLES[a] = await measuredSheetBattle({ archetype: a });
});

describe('the six archetypes\' facts, pinned (golden)', () => {
  it('every candidate item of every archetype: kind, fact, source label, status', () => {
    const now = {};
    for (const a of ARCHETYPES) {
      const built = buildPacks(args(BATTLES[a]));
      now[a] = {
        items: items(BATTLES[a]).map((i) => [i.kind, i.fact, i.source.label, i.status, i.statusReason]),
        packs: Object.fromEntries(Object.entries(built.packs).map(([q, p]) => [q, p.items.map((i) => i.kind)])),
      };
    }
    if (GENERATE) writeFileSync(GOLDEN, `${JSON.stringify(now, null, 1)}\n`);
    expect(now).toEqual(JSON.parse(readFileSync(GOLDEN, 'utf8')));
  });
});

describe('the numbers, worked by hand on the shared fixture (Trend Follower, live $103.20, scored $103.40, fill $100.75)', () => {
  it('banked: +15, and the NEXT check slot (1:15 at 1:07 PM ET) — never "now"', () => {
    expect(factOf(items(BATTLES.momentum_chaser), 'banked')).toBe('+15 banked at the checks · next check 1:15');
  });
  it('the check read: chg is FROM ENTRY (+2.6%), atrX in the scorer\'s rung unit (1.05×) — never a percent', () => {
    expect(factOf(items(BATTLES.momentum_chaser), 'check_read')).toContain('+2.6% from entry');
    expect(factOf(items(BATTLES.momentum_chaser), 'check_read')).toContain('1.05× a rung step (the first rung is 1.00×)');
  });
  it('the rung compare: from the SCORED price, in displayed values ($103.77 − $103.40 = $0.37 to +30)', () => {
    expect(factOf(items(BATTLES.momentum_chaser), 'rung_compare')).toContain('AAPL $0.37 from +30');
  });
  it('the standing: the header\'s text and lead', () => {
    expect(factOf(items(BATTLES.momentum_chaser), 'standing')).toBe('You trail +62 – +68');
  });
});

describe('the distance to the next rung is Bomb mode\'s own number (ladder.js toGo; BUILD_RULES §9 — review A5)', () => {
  it('live $102.2673, rung $103.7725: "$1.50 (1.47%) to go" — the displayed $103.77 − $102.27, of $102.27', () => {
    const live = 102.2673;
    expect(factOf(items(BATTLES.momentum_chaser, { live }), 'rung_distance')).toBe('Next rung +30 at $103.77 · $1.50 (1.47%) to go');
    const go = toGo(holdingOf(BATTLES.momentum_chaser, 'AAPL', SHEET_NOW, ROW).ladder, live);
    expect([go.distance, go.pctShown]).toEqual([1.5, 1.47]);
  });
  it('the live price at or past the next rung: no distance item (it banks only at a check — never a negative "to go")', () => {
    expect(factOf(items(BATTLES.momentum_chaser, { live: 103.78 }), 'rung_distance')).toBeUndefined();
    expect(factOf(items(BATTLES.momentum_chaser, { live: 104.5 }), 'rung_distance')).toBeUndefined();
  });
});

describe('the drawdown names the day its bars start, measures from the high, and never shows a high under the live price (review A11, C3)', () => {
  it('off the high: (110 − 103.20) / 110 = 6.2% — the entry day\'s bar on; an older, higher bar is never counted', () => {
    const bars = [
      { date: '2026-10-14', open: 105, high: 110, low: 103, close: 103.2 },
      { date: '2026-10-13', open: 120, high: 130, low: 99, close: 101 },
    ];
    expect(factOf(items(BATTLES.momentum_chaser, { dailyBars: bars }), 'drawdown')).toBe('6.2% off its high since Wed 10/14 ($110.00, Wed 10/14)');
  });
  it('the live price above every bar\'s high: the high IS the live price', () => {
    const it0 = items(BATTLES.momentum_chaser, { live: 105.5 }).find((i) => i.kind === 'drawdown');
    expect(it0.fact).toBe('At its high since Wed 10/14: $105.50 live');
    expect(it0.pin).toEqual({ type: 'price', value: 105.5 });
  });
});

describe('the risk words say what the check does (review A13, C7)', () => {
  const withRisk = (risk) => { const b = clone(BATTLES.momentum_chaser); b.evaluations[1].evidence.AAPL.risk = risk; return b; };
  it('TRAIL_STOP is an exit — the cron swaps it out — never "protect the gain"', () => {
    expect(RISK_WORDS.TRAIL_STOP).toBe('swap it out — its trailing stop tripped');
    expect(factOf(items(withRisk({ action: 'TRAIL_STOP', reason: 'stepped_trail' })), 'risk_verdict')).toBe('Risk check at Wed 12:45: swap it out — its trailing stop tripped');
  });
  it('SWAP_OUT names its reason in plain words', () => {
    expect(factOf(items(withRisk({ action: 'SWAP_OUT', reason: 'vwap_failure' })), 'risk_verdict')).toBe(`Risk check at Wed 12:45: swap it out (${RISK_REASON_WORDS.vwap_failure})`);
  });
});

describe('the stall count is the one the check uses: the tempo dial clamps it (agent-evaluate.js :1909-1913 — review A1)', () => {
  const withTempo = (tempo) => { const b = clone(BATTLES.momentum_chaser); b.agentContext = { ...b.agentContext, dials: { ...(b.agentContext?.dials ?? {}), tempo } }; return b; };
  it('Trend Follower: standard 5 (ETH at 6 is stalled), measured 7 (it is not), aggressive 4', () => {
    expect(factOf(items(BATTLES.momentum_chaser), 'stalled')).toBe('Stalled by Trend Follower’s own count (5 quiet checks): ETH (6)');
    expect(factOf(items(withTempo('measured')), 'stalled')).toBe('None of its names has reached 7 quiet checks');
    expect(factOf(items(withTempo('aggressive')), 'stalled')).toBe('Stalled by Trend Follower’s own count (4 quiet checks): ETH (6)');
  });
});
