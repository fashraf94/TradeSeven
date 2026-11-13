// Research Modal Build C — THE PACKS (spec BC-4, BC-5, BC-6, BC-9, BC-10, BC-11,
// BC-13, BC-15, §3.2–§3.4) on the real corrected-battle harness (a stamped
// battle, a bound receipt, a committed score patch — Build A's selector reads
// it exactly as production).

import { describe, it, expect, beforeAll } from 'vitest';
import { measuredSheetBattle, SHEET_NOW, ARCHETYPES, AAPL_DAILY, RANKINGS } from './__fixtures__/sheetBattles.js';
import {
  buildPacks, candidateItems, packFor, orderItems, lensOf, defensivenessOf, weightOf, stanceOf, questionOrder, recordPinsOf, ideaOf,
  directiveFor, incumbentOfCall, itemKeyOf, QUESTION_IDS, ITEM_KINDS, RECORD_KINDS, KIND_FACTOR, SERVER_KINDS, CLIENT_REASON, PACK_MAX, FACT_MAX, LOOP_KINDS,
} from './packs.js';

const ROW = { positionId: 'position-agent' };
const full = (battle, over = {}) => ({ battle, symbol: 'AAPL', nowMs: SHEET_NOW, row: ROW, live: 103.2, dailyBars: AAPL_DAILY, rankings: RANKINGS, standing: { player: 62, opponent: 68 }, directive: battle.directive, incumbent: 'ETH', battleId: 'stock-battle', ...over });
const kinds = (pack) => pack.items.map((i) => i.kind);

const BATTLES = {};
beforeAll(async () => {
  for (const a of ARCHETYPES) BATTLES[a] = await measuredSheetBattle({ archetype: a });
});

// ── The six-archetype snapshot (spec §6 "all three questions for all six archetypes on one fixture") ──
const SNAPSHOT = {
  momentum_chaser: {
    catch_up: ['move_since_entry', 'rule_trend', 'rung_distance', 'idea', 'told_it'],
    protect_lead: ['banked', 'drawdown', 'risk_lever', 'idea', 'told_it'],
    better_than_stalled: ['incumbent', 'stalled', 'rank_scores', 'idea', 'told_it'],
  },
  contrarian: {
    catch_up: ['rule_contrarian', 'check_read', 'rung_distance', 'idea', 'told_it'],
    protect_lead: ['risk_lever', 'risk_verdict', 'drawdown', 'idea', 'told_it'],
    better_than_stalled: ['rank_scores', 'rung_compare', 'incumbent', 'idea', 'told_it'],
  },
  degen: {
    catch_up: ['check_read', 'rule_volatility', 'rung_distance', 'idea', 'told_it'],
    protect_lead: ['drawdown', 'banked', 'risk_lever', 'idea', 'told_it'],
    better_than_stalled: ['rank_scores', 'rung_compare', 'incumbent', 'idea', 'told_it'],
  },
  guardian: {
    catch_up: ['rule_sectors', 'move_since_entry', 'rung_distance', 'idea', 'told_it'],
    protect_lead: ['risk_lever', 'risk_verdict', 'banked', 'idea', 'told_it'],
    better_than_stalled: ['rank_scores', 'incumbent', 'stalled', 'idea', 'told_it'],
  },
  diversifier: {
    catch_up: ['rule_sectors', 'rung_distance', 'move_since_entry', 'idea', 'told_it'],
    protect_lead: ['risk_lever', 'risk_verdict', 'banked', 'idea', 'told_it'],
    better_than_stalled: ['rank_scores', 'incumbent', 'stalled', 'idea', 'told_it'],
  },
  analyst: {
    catch_up: ['rule_fundamentals', 'move_since_entry', 'rung_distance', 'idea', 'told_it'],
    protect_lead: ['risk_lever', 'risk_verdict', 'banked', 'idea', 'told_it'],
    better_than_stalled: ['rank_scores', 'incumbent', 'stalled', 'idea', 'told_it'],
  },
};

describe('the six-archetype snapshot — one fixture stock, all three questions', () => {
  it.each(ARCHETYPES)('%s: each pack\'s kinds in order, labelled "What {Archetype} weighs"', (a) => {
    const { packs, lens } = buildPacks(full(BATTLES[a]));
    for (const q of QUESTION_IDS) {
      expect(kinds(packs[q]), `${a} ${q}`).toEqual(SNAPSHOT[a][q]);
      expect(packs[q].label).toBe(`What ${lens.label} weighs`);
    }
  });
});

describe('§3.3 acceptance', () => {
  it('for one fixture stock, at least four of the six archetypes give a different first item for some question', () => {
    const firsts = ARCHETYPES.map((a) => buildPacks(full(BATTLES[a])).packs.catch_up.items[0].kind);
    expect(new Set(firsts).size).toBeGreaterThanOrEqual(4);
  });
  it("Capital Preserver's protect the lead leads with a risk item", () => {
    const first = buildPacks(full(BATTLES.guardian)).packs.protect_lead.items[0];
    expect(['risk_lever', 'risk_verdict']).toContain(first.kind);
    expect(first.fact).toMatch(/^Capital Preserver on Defensive: swaps out 0\.75 ATR below entry/);
  });
  it("Speculator's catch up leads with volatility or the distance to the rung", () => {
    const first = buildPacks(full(BATTLES.degen)).packs.catch_up.items[0];
    expect(['check_read', 'rung_distance', 'rule_volatility']).toContain(first.kind);
    expect(KIND_FACTOR[first.kind] === 'atrPercentile' || first.kind === 'rung_distance').toBe(true);
  });
});

describe('the ordering table (§3.3)', () => {
  it('every kind has one factor in the table, and the loop kinds are the idea and what you told it', () => {
    expect(Object.keys(KIND_FACTOR).sort()).toEqual([...ITEM_KINDS].sort());
    expect(ITEM_KINDS.filter((k) => KIND_FACTOR[k] === 'loop')).toEqual([...LOOP_KINDS]);
  });
  it('defensiveness from the preset levers: aggressive 0, balanced ≈ 0.33, defensive 1', () => {
    expect(defensivenessOf('aggressive')).toBe(0);
    expect(defensivenessOf('defensive')).toBe(1);
    expect(defensivenessOf('balanced')).toBeCloseTo(1 / 3, 6);
    expect(defensivenessOf('nope')).toBe(0);
  });
  it("the lens reads the battle's OWN preset (strategyPreset, the check's), not the archetype's default", () => {
    const b = { ...BATTLES.guardian, strategyPreset: 'aggressive' };
    const lens = lensOf(b);
    expect(lens.presetKey).toBe('aggressive');
    expect(lens.defensiveness).toBe(0);
    expect(lensOf({ ...b, strategyPreset: 'not-a-preset' }).presetKey).toBe('balanced');
    expect(buildPacks(full(b)).packs.protect_lead.items[0].kind).not.toBe('risk_lever');
  });
  it('an item weighs what the archetype weighs on its factor; risk items weigh the defensiveness', () => {
    const tf = lensOf(BATTLES.momentum_chaser);
    expect(weightOf('move_since_entry', tf)).toBe(0.4);
    expect(weightOf('check_read', tf)).toBe(0.25);
    expect(weightOf('risk_lever', lensOf(BATTLES.guardian))).toBe(1);
    expect(weightOf('rank_scores', tf)).toBe(0.4);
    expect(weightOf('standing', tf)).toBe(0);
  });
  it('the loop items are never cut; the ordered items fill the rest of the five', () => {
    const lens = lensOf(BATTLES.momentum_chaser);
    const it = (kind) => ({ kind, fact: kind });
    const out = orderItems(['standing', 'idea', 'rung_distance', 'told_it', 'move_since_entry', 'check_read', 'rule_trend'].map(it), lens);
    expect(out.map((x) => x.kind)).toEqual(['move_since_entry', 'rule_trend', 'rung_distance', 'idea', 'told_it']);
    expect(out).toHaveLength(PACK_MAX);
  });
});

describe('BC-4 — the item shape, omission, the label', () => {
  it('every item is the research record finding shape without findingId and supersedes, from the closed vocabularies', () => {
    const { items } = candidateItems(full(BATTLES.momentum_chaser));
    for (const i of items) {
      expect(Object.keys(i)).toEqual(['kind', 'symbol', 'fact', 'source', 'at', 'asOf', 'status', 'statusReason', 'pin']);
      expect(Object.keys(i.source)).toEqual(['recordKind', 'recordId', 'label']);
      expect(ITEM_KINDS).toContain(i.kind);
      expect(RECORD_KINDS).toContain(i.source.recordKind);
      expect(i.fact.length).toBeLessThanOrEqual(FACT_MAX);
      expect(i.at === null || /^\d{4}-\d{2}-\d{2}T.*Z$/.test(i.at)).toBe(true);
      if (SERVER_KINDS.includes(i.kind)) expect([i.status, i.statusReason]).toEqual(['verified', null]);
      else expect([i.status, i.statusReason]).toEqual(['unverified', CLIENT_REASON[i.kind]]);
    }
  });
  it('a candidate with nothing behind it is omitted, never shown as "n/a"', () => {
    const bare = { status: 'active', portfolio: { star: [], core: [], support: [] }, agentContext: { archetype: 'momentum_chaser' } };
    const { packs } = buildPacks({ battle: bare, symbol: 'KO', nowMs: SHEET_NOW });
    expect(kinds(packs.catch_up)).toEqual(['rule_trend']);
    expect(kinds(packs.protect_lead)).toEqual(['risk_lever']);
    expect(kinds(packs.better_than_stalled)).toEqual(['stalled']);
    const all = Object.values(packs).flatMap((p) => p.items.map((i) => i.fact)).join(' ');
    expect(all).not.toMatch(/n\/a|undefined|null|NaN/i);
  });
  it('the client-only kinds are absent without their client input (no live price, no bars, no rankings, no standing)', () => {
    const { items } = candidateItems({ battle: BATTLES.momentum_chaser, symbol: 'AAPL', nowMs: SHEET_NOW, row: ROW });
    for (const k of ['rung_distance', 'move_since_entry', 'drawdown', 'rank_scores', 'standing']) expect(items.map((i) => i.kind)).not.toContain(k);
  });
  it('no pack is built for an unknown question', () => {
    expect(packFor('what_now', candidateItems(full(BATTLES.momentum_chaser)))).toBeNull();
  });
  it('BS-2: an item\'s key (itemKeyOf: its kind and symbol, no new field) is unique within every pack — every archetype, at prices on both sides of the next rung, with and without an incumbent', () => {
    for (const a of ARCHETYPES) {
      for (const live of [103.2, 103.83, 99.1]) {
        for (const incumbent of ['ETH', null]) {
          const { items } = candidateItems(full(BATTLES[a], { live, incumbent }));
          // The source of the guarantee: at most one candidate per kind.
          expect(new Set(items.map((i) => i.kind)).size).toBe(items.length);
          const { packs } = buildPacks(full(BATTLES[a], { live, incumbent }));
          for (const q of QUESTION_IDS) {
            const keys = packs[q].items.map(itemKeyOf);
            expect(new Set(keys).size).toBe(keys.length);
          }
        }
      }
    }
    expect(itemKeyOf({ kind: 'rung_distance', symbol: 'AAPL', fact: 'x' })).toBe('rung_distance|AAPL');
  });
});

describe('BC-5 — no stop price, ever', () => {
  it.each(ARCHETYPES)('%s: no item names a stop or a target, and the risk items carry no price', (a) => {
    const { items } = candidateItems(full(BATTLES[a]));
    for (const i of items) expect(i.fact).not.toMatch(/\bstop\b|\btarget\b/i);
    for (const i of items.filter((x) => x.kind === 'risk_lever' || x.kind === 'risk_verdict')) expect(i.fact).not.toMatch(/\$/);
  });
  it('the lever says what the code does: swaps out N ATR below entry, after N checks IN A ROW under VWAP ending past the dead band, and past +N ATR a dip under the 5-min average SELLS (agentRiskManager.js evaluateRiskAction; review A13/A17)', () => {
    const lever = candidateItems(full(BATTLES.momentum_chaser)).items.find((i) => i.kind === 'risk_lever');
    expect(lever.fact).toBe('Trend Follower on Aggressive: swaps out 0.9 ATR below entry, or after 3 checks in a row under VWAP ending 0.7% below; past +1.5 ATR, a dip under its 5-min average sells it');
  });
  it('the risk verdict is the latest check\'s, in plain words with its time', () => {
    const v = candidateItems(full(BATTLES.momentum_chaser)).items.find((i) => i.kind === 'risk_verdict');
    expect(v.fact).toBe('Risk check at Wed 12:45: hold — close to the next rung');
    expect(v.source).toEqual({ recordKind: 'evaluation', recordId: 'e2', label: 'the Wed 12:45 check' });
  });
});

describe("BC-6 — stalled is the agent's own counter", () => {
  it('a held name at or over its archetype\'s forcedRotation.ticksThreshold is listed with its count', () => {
    const s = candidateItems(full(BATTLES.momentum_chaser)).items.find((i) => i.kind === 'stalled');
    expect(s.fact).toBe('Stalled by Trend Follower’s own count (5 quiet checks): ETH (6)');
    const under = candidateItems(full({ ...BATTLES.momentum_chaser, cronState: { stagnationTicks: { ETH: 4 } } })).items.find((i) => i.kind === 'stalled');
    expect(under.fact).toBe('None of its names has reached 5 quiet checks');
  });
  it("Capital Preserver has forced rotation off: it says so and lists none", () => {
    const s = candidateItems(full(BATTLES.guardian)).items.find((i) => i.kind === 'stalled');
    expect(s.fact).toBe('Capital Preserver doesn’t rotate out of quiet names');
    expect(s.fact).not.toMatch(/ETH/);
  });
  it('the threshold is the archetype\'s own (resolveHftConfig): Speculator counts 3, Fundamental Investor 6', () => {
    expect(candidateItems(full(BATTLES.degen)).items.find((i) => i.kind === 'stalled').fact).toMatch(/\(3 quiet checks\)/);
    expect(candidateItems(full(BATTLES.analyst)).items.find((i) => i.kind === 'stalled').fact).toMatch(/\(6 quiet checks\)/);
  });
  it('never says the name WILL rotate (the fire also needs a fresh tick and a non-winning day)', () => {
    for (const a of ARCHETYPES) for (const i of candidateItems(full(BATTLES[a])).items) expect(i.fact).not.toMatch(/will rotate|will be swapped|will swap/i);
  });
});

describe('BC-10 — what you told it', () => {
  const d = (over) => ({ text: 'Keep AAPL through the close.', directiveThreadId: 't1', createdAt: '2026-10-14T15:40:00.000Z', ...over });
  it('names the symbol as a whole uppercase token of three or more letters', () => {
    expect(directiveFor(d(), 'AAPL')).not.toBeNull();
    expect(directiveFor(d({ text: 'Keep AAPLX.' }), 'AAPL')).toBeNull();
    expect(directiveFor(d({ text: 'keep aapl' }), 'AAPL')).toBeNull();
  });
  it('a two-letter ticker never matches by text; a call-family directive matches by action.symbol', () => {
    expect(directiveFor(d({ text: 'Sell GE now.' }), 'GE')).toBeNull();
    expect(directiveFor(d({ text: 'Bring it in.', family: 'call', action: { symbol: 'GE' } }), 'GE')).not.toBeNull();
    expect(directiveFor(d({ text: 'Bring it in.', family: 'call', action: { symbol: 'XOM' } }), 'GE')).toBeNull();
  });
  it('labelled "What you told it · {time}", and "· from this morning\'s huddle" when the thread starts with plan:', () => {
    const plain = candidateItems(full(BATTLES.momentum_chaser)).items.find((i) => i.kind === 'told_it');
    expect(plain.source.label).toBe('What you told it · Wed 11:40');
    const huddle = candidateItems(full(BATTLES.momentum_chaser, { directive: d({ directiveThreadId: 'plan:u1:2026-10-14:abc' }) })).items.find((i) => i.kind === 'told_it');
    expect(huddle.source.label).toBe('What you told it · Wed 11:40 · from this morning’s huddle');
  });
  it('no directive, or one about another name: no item', () => {
    expect(candidateItems(full(BATTLES.momentum_chaser, { directive: null })).items.map((i) => i.kind)).not.toContain('told_it');
    expect(candidateItems(full(BATTLES.momentum_chaser, { directive: d({ text: 'Watch NVDA.' }) })).items.map((i) => i.kind)).not.toContain('told_it');
  });
});

describe('BC-11 — the incumbent', () => {
  it('with an incumbent the agent holds: an item naming it, side by side in the ranking', () => {
    const { packs } = buildPacks(full(BATTLES.momentum_chaser));
    const inc = packs.better_than_stalled.items.find((i) => i.kind === 'incumbent');
    expect(inc.symbol).toBe('ETH');
    expect(inc.fact).toBe('ETH is the name it would replace · 6 quiet checks in a row; Trend Follower counts a name stalled at 5');
    expect(packs.better_than_stalled.items.find((i) => i.kind === 'rank_scores').fact).toBe('Trend Follower’s ranking: AAPL 78 · ETH 52 (rankings as of Wed 10/14)');
  });
  it('without one (every other door), or one the agent does not hold: no incumbent item', () => {
    expect(candidateItems(full(BATTLES.momentum_chaser, { incumbent: null })).items.map((i) => i.kind)).not.toContain('incumbent');
    expect(candidateItems(full(BATTLES.momentum_chaser, { incumbent: 'MSFT' })).items.map((i) => i.kind)).not.toContain('incumbent');
  });
});

describe('BC-11 — which held name a cockpit call would replace (the bench door of the screen)', () => {
  it('an exit call ("Who comes in?"): its own symbol; an entry call: its counterpart; anything else, or the opened name itself: none', () => {
    expect(incumbentOfCall({ direction: 'exit', symbol: 'ETH', counterpart: null }, 'NVDA')).toBe('ETH');
    expect(incumbentOfCall({ direction: 'entry', symbol: 'NVDA', counterpart: 'ETH' }, 'NVDA')).toBe('ETH');
    expect(incumbentOfCall({ direction: 'entry', symbol: 'NVDA', counterpart: null }, 'NVDA')).toBeNull();
    expect(incumbentOfCall({ direction: 'hold', symbol: 'ETH' }, 'NVDA')).toBeNull();
    expect(incumbentOfCall(null, 'NVDA')).toBeNull();
    expect(incumbentOfCall({ direction: 'exit', symbol: 'NVDA' }, 'NVDA')).toBeNull();
  });
});

describe('BC-15 — the stance', () => {
  const stance = (battle, symbol, over = {}) => stanceOf({ battle, symbol, nowMs: SHEET_NOW, row: ROW, live: 103.2, ...over });
  it('a measured holding: since, entry, the move (one number with the item), banked', () => {
    const s = stance(BATTLES.momentum_chaser, 'AAPL');
    expect(s.kind).toBe('held_measured');
    expect(s.chips.map((c) => c.text)).toEqual(['Holding since Wed 10/14', 'entry $100.75 · +2.4%', '+15 banked', 'In this game’s idea · since Tue 10/13']);
    const move = candidateItems(full(BATTLES.momentum_chaser)).items.find((i) => i.kind === 'move_since_entry');
    expect(move.fact.startsWith('+2.4% since entry at $100.75')).toBe(true);
  });
  it('a legacy-scored holding: no entry, nothing banked, and its packs omit the rung items', async () => {
    const legacy = await measuredSheetBattle({ archetype: 'momentum_chaser' });
    delete legacy.scoring.stockThresholdModel;
    const s = stance(legacy, 'AAPL');
    expect(s.kind).toBe('held');
    expect(s.chips.map((c) => c.text)).toEqual(['Holding since Wed 10/14', 'In this game’s idea · since Tue 10/13']);
    const k = candidateItems(full(legacy)).items.map((i) => i.kind);
    for (const r of ['rung_distance', 'move_since_entry', 'banked', 'drawdown', 'rung_compare']) expect(k).not.toContain(r);
    const read = candidateItems(full(legacy)).items.find((i) => i.kind === 'check_read');
    expect(read.fact).not.toMatch(/from entry|rung step/);
  });
  it('a crypto holding: "Holding since", nothing else', () => {
    expect(stance(BATTLES.momentum_chaser, 'ETH', { row: { positionId: 'position-eth' } }).chips.map((c) => c.text)).toEqual(['Holding since Wed 10/14', 'In this game’s idea · since Tue 10/13']);
  });
  it('a bench name on the latest candidates list: "On the bench · flagged at {time}"', () => {
    expect(stance(BATTLES.momentum_chaser, 'NVDA').chips.map((c) => c.text)).toEqual(['On the bench · flagged at Wed 12:45']);
  });
  it('any other name: "Not examined in this game", or "In this game\'s idea · not examined" on the frozen list', () => {
    expect(stance(BATTLES.momentum_chaser, 'KO')).toMatchObject({ kind: 'unexamined', chips: [{ text: 'Not examined in this game' }] });
    expect(stance(BATTLES.momentum_chaser, 'MSFT')).toMatchObject({ kind: 'idea_unexamined', chips: [{ text: 'In this game’s idea · not examined' }] });
  });
  it('a name a check examined, not held now: "Looked at {time} · not held now" — never "Not examined" (FQ-2, 2026-11-08)', () => {
    const b = JSON.parse(JSON.stringify(BATTLES.momentum_chaser));
    b.evaluations.unshift({ evalId: 'e0', timestamp: '2026-10-13T15:00:00.000Z', rationale: 'XOM lost VWAP, so it goes.', evidence: { XOM: { px: 110 } } });
    expect(stance(b, 'XOM')).toMatchObject({ kind: 'looked', chips: [{ text: 'Looked at Tue 11:00 · not held now' }] });
  });
  it('an exit-flagged name not held reads "Looked at" its flagging check; on the frozen list it also carries the idea chip (FQ-2)', () => {
    const b = JSON.parse(JSON.stringify(BATTLES.momentum_chaser));
    b.evaluations[1].candidates.push({ symbol: 'XOM', direction: 'potential_exit', signalSummary: 'Exit: lost VWAP twice.' });
    expect(stance(b, 'XOM').chips.map((c) => c.text)).toEqual(['Looked at Wed 12:45 · not held now']);
    b.evaluations[0].evidence.MSFT = { px: 410 };
    expect(stance(b, 'MSFT')).toMatchObject({ kind: 'looked', chips: [{ text: 'Looked at Wed 11:30 · not held now' }, { text: 'In this game’s idea · since Tue 10/13' }] });
  });
  it('a FAILED check that stamped the name is not a look: still "Not examined" (the A2 reading)', () => {
    const b = JSON.parse(JSON.stringify(BATTLES.momentum_chaser));
    b.evaluations.push({ evalId: 'e9', timestamp: '2026-10-14T16:50:00.000Z', rationale: 'Haiku call failed — defaulting to HOLD', evidence: { KO: { px: 68 } }, haikuError: { failureClass: 'timeout', evalId: 'e9' } });
    expect(stance(b, 'KO').kind).toBe('unexamined');
  });
  it("the CPU's row of a shared ticker is not the agent's holding (Build A's row identity)", () => {
    expect(stance(BATTLES.momentum_chaser, 'AAPL', { row: { positionId: 'position-cpu' } }).kind).not.toMatch(/^held/);
  });
});

describe('BC-9 — the idea layer, by omission', () => {
  it('applies on the frozen list or when a condition names the stock; absent with no idea carried', () => {
    expect(ideaOf(BATTLES.momentum_chaser, 'AAPL')).toMatchObject({ onList: true, conditions: [{ role: 'live', side: 'above', level: 98.5 }, { role: 'wrong', side: 'below', level: 96.2 }] });
    expect(ideaOf(BATTLES.momentum_chaser, 'KO')).toBeNull();
    const noIdea = { ...BATTLES.momentum_chaser, agentContext: { ...BATTLES.momentum_chaser.agentContext, equippedHypothesis: undefined } };
    expect(ideaOf(noIdea, 'AAPL')).toBeNull();
    expect(stanceOf({ battle: noIdea, symbol: 'AAPL', nowMs: SHEET_NOW, row: ROW, live: 103.2 }).chips.map((c) => c.text).join(' ')).not.toMatch(/idea/);
    expect(recordPinsOf({ battle: noIdea, symbol: 'AAPL', nowMs: SHEET_NOW, row: ROW, calls: [] }).lines.filter((l) => l.group === 'idea')).toEqual([]);
  });
});

describe('BC-13 — the questions in standing order', () => {
  it('trailing → catch up first; leading → protect the lead first; tied or unknown → the design\'s order', () => {
    expect(questionOrder({ player: 62, opponent: 68 })).toEqual(['catch_up', 'protect_lead', 'better_than_stalled']);
    expect(questionOrder({ player: 70, opponent: 68 })).toEqual(['protect_lead', 'catch_up', 'better_than_stalled']);
    expect(questionOrder({ player: 68, opponent: 68 })).toEqual(['catch_up', 'protect_lead', 'better_than_stalled']);
    expect(questionOrder(null)).toEqual(['catch_up', 'protect_lead', 'better_than_stalled']);
  });
  it('the HEADER\'s lead decides, never the rounded digits: 1234.4 vs 1234.1 shows +1234 / +1234 and "You lead by less than 1" — protect the lead first (review A6)', () => {
    const shown = { player: 1234.4, opponent: 1234.1, digits: 0, you: '+1234', them: '+1234', lead: 'player' };
    expect(questionOrder(shown)).toEqual(['protect_lead', 'catch_up', 'better_than_stalled']);
    expect(questionOrder({ ...shown, lead: 'tie' })).toEqual(['catch_up', 'protect_lead', 'better_than_stalled']);
    expect(questionOrder({ ...shown, lead: 'cpu' })).toEqual(['catch_up', 'protect_lead', 'better_than_stalled']);
    // A caller with numbers only: the precise pair's lead.
    expect(questionOrder({ player: 68.4, opponent: 68.2, digits: 0 })).toEqual(['protect_lead', 'catch_up', 'better_than_stalled']);
  });
  it('the standing item prints the header\'s own text and words its lead (review A6): "-2" / "+12", never toFixed\'s "-3" / "12"', () => {
    const item = (standing) => candidateItems({ ...full(BATTLES.momentum_chaser), standing }).items.find((i) => i.kind === 'standing');
    expect(item({ player: -2.5, opponent: 12, digits: 0, you: '-2', them: '+12', lead: 'cpu' }).fact).toBe('You trail -2 – +12');
    expect(item({ player: 1234.4, opponent: 1234.1, digits: 0, you: '+1234', them: '+1234', lead: 'player' }).fact).toBe('You lead +1234 – +1234');
    expect(item({ player: 5, opponent: 5, digits: 0, you: '+5', them: '+5', lead: 'tie' }).fact).toBe('Tied +5 – +5');
    expect(item({ player: 62, opponent: 68, digits: 0 }).fact).toBe('You trail 62 – 68');
    expect(item(null)).toBeUndefined();
  });
});

describe('BC-8 — the record pinned', () => {
  it('markers: the entry day, the calls naming the symbol and their answers, the latest check; lines: the measured entry and the idea\'s conditions', () => {
    const calls = [{ callId: 'c1', symbol: 'AAPL', mintedAt: Date.parse('2026-10-13T15:30:00.000Z'), playerResponse: { filedAt: Date.parse('2026-10-13T15:41:00.000Z') } }, { callId: 'c2', symbol: 'XOM', mintedAt: 1 }];
    const pins = recordPinsOf({ battle: BATTLES.momentum_chaser, symbol: 'AAPL', nowMs: SHEET_NOW, row: ROW, calls });
    expect(pins.markers.map((m) => [m.kind, m.label])).toEqual([
      ['call', 'Called · Tue 11:30'], ['answer', 'You answered · Tue 11:41'], ['entry', 'Entry · Wed 9:47'] /* BD-9 (2026-11-10): the record's entry instant is the fill quote's time; the sheet's marker reads the same field (§9) */, ['check', 'What it decided · Wed 12:45'],
    ]);
    expect(pins.lines.map((l) => [l.kind, l.price, l.label, l.group])).toEqual([
      ['entry', 100.75, 'entry $100.75', 'record'], ['idea_live', 98.5, 'live above $98.50', 'idea'], ['idea_wrong', 96.2, 'wrong below $96.20', 'idea'],
    ]);
  });
  it('a bench name the check only FLAGGED: its pin says "What it flagged", never "What it decided" (the voice line\'s own word)', () => {
    const pins = recordPinsOf({ battle: BATTLES.momentum_chaser, symbol: 'NVDA', nowMs: SHEET_NOW, row: {}, calls: [] });
    expect(pins.markers.map((m) => [m.kind, m.label])).toEqual([['check', 'What it flagged · Wed 12:45']]);
  });
  it('the check pin names the check the voice line quotes: a newer FAILED check that stamped the name is skipped (FQ-1)', () => {
    const b = JSON.parse(JSON.stringify(BATTLES.momentum_chaser));
    b.evaluations.push({ evalId: 'e9', timestamp: '2026-10-14T16:55:00.000Z', rationale: 'Haiku call failed — defaulting to HOLD', evidence: { AAPL: { px: 103.3 } }, haikuError: { failureClass: 'timeout', evalId: 'e9' } });
    const check = recordPinsOf({ battle: b, symbol: 'AAPL', nowMs: SHEET_NOW, row: ROW, calls: [] }).markers.find((m) => m.kind === 'check');
    expect([check.id, check.label]).toEqual(['check:e2', 'What it decided · Wed 12:45']);
  });
  it('a HELD name the check also listed (an exit flag) keeps "What it decided": the check had its evidence', () => {
    const b = JSON.parse(JSON.stringify(BATTLES.momentum_chaser));
    b.evaluations[1].candidates.push({ symbol: 'AAPL', direction: 'potential_exit', signalSummary: 'Exit: lost VWAP.' });
    const pins = recordPinsOf({ battle: b, symbol: 'AAPL', nowMs: SHEET_NOW, row: ROW, calls: [] });
    expect(pins.markers.find((m) => m.kind === 'check').label).toBe('What it decided · Wed 12:45');
  });
  it('a legacy-scored holding pins no entry (BC-15)', async () => {
    const legacy = await measuredSheetBattle();
    delete legacy.scoring.stockThresholdModel;
    const pins = recordPinsOf({ battle: legacy, symbol: 'AAPL', nowMs: SHEET_NOW, row: ROW, calls: [] });
    expect(pins.markers.map((m) => m.kind)).not.toContain('entry');
    expect(pins.lines.map((l) => l.kind)).not.toContain('entry');
  });
});
