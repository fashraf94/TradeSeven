// api/_utils/callRecords/amendmentC.test.js
//
// Cockpit Build 2a — CONTRACT AMENDMENT C, C-1 to C-5 (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md S-1, S-2, §11 "Server"). Each clause is
// driven through the real validator, the real mint and the real model-path
// phase against the calls store fixture:
//   C-1 the top-level watch list (read only when the block carries no
//       non-empty list; the same rules; watching-only records; watchingSource;
//       top-level fork / playerAsk never read)
//   C-2 heldAtMint from the held set frozen at the model seam
//   C-3 counterpart usability — every class of the discovery's D-B5 table
//   C-4 saidOk per call, equal to the lint's own verdict
//   C-5 mintedMode on calls AND the declarations record
//
// Dependency-surface guard (BUILD_RULES §4): the imports below are the call
// records modules themselves and are never mocked.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDeclarations, captureDeclarations, readsTopLevelWatching, WATCHING_SOURCES, DECLARATION_CAPS } from './validate.js';
import { buildMintCandidate, counterpartUsable, counterpartRawOf, saidOkOf, MINTED_MODES, COUNTERPART_RAW_MAX } from './candidate.js';
import { runModelCallsPhase } from './publish.js';
import { createCallsContext } from './mode.js';
import { freezeModelObservation, benchCooldownLocked } from './observe.js';
import { renderCallActionText, isCallActionEligible } from './callActions.js';
import { planFlip, matchesWholeTrade } from './flip.js';
import { classifyAnswer, ANSWERS_1A } from './answers.js';
import { bindHorizon, battleExpiryMs } from './horizon.js';
import { saidPassesLint } from './copy.js';
import { FROZEN_NOW, HELD, makeTickBattle, makeDeclarations, makeObservation } from '../__fixtures__/tickStampsHarness.js';
import { makeCallsDb, storedDoc, storedCollection } from '../__fixtures__/callRecordsStore.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CRON = readFileSync(resolve(HERE, '../../cron/agent-evaluate.js'), 'utf8');

const BATTLE_ID = 'battle-tick-1';
const EVAL_ID = 'eval_001';
const UNIVERSE = ['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC', 'AMD', 'JPM'];
const PROMPT_MS = Date.parse(FROZEN_NOW);
const MINT = PROMPT_MS + 20_000;
const TIME_BUDGET_MS = 290_000;

const shot = (over = {}) => ({
  symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO',
  condition: { side: 'above', level: 163.5 }, horizonPhrase: 'this_session', defaultAction: 'act',
  said: 'AMD into Support if it holds.', ...over,
});
const run = (block, ctx = {}) => validateDeclarations(block, { universe: UNIVERSE, ...ctx });
const committedBattle = (over = {}) => makeTickBattle({ cronState: { ...makeTickBattle().cronState, evalSeq: 1 }, ...over });
const mint = (raw, over = {}) => buildMintCandidate({
  battleId: BATTLE_ID, evalId: EVAL_ID, evalSeq: 1, mintedAtMs: MINT, raw, universe: UNIVERSE,
  observation: makeObservation(), promptBuiltAt: FROZEN_NOW, tickId: null, battle: committedBattle(),
  held: [...HELD], mintedMode: 'shadow', ...over,
});

// ---------------------------------------------------------------------------
describe('C-1 — the top-level watch list', () => {
  it('a block with its OWN non-empty list keeps it: the top level is not read, watchingSource "declarations"', () => {
    const r = run({ watching: ['JPM'] }, { topLevelWatching: ['MU', 'GME'] });
    expect(r.validated.watching).toEqual(['JPM']);
    expect(r.watchingSource).toBe('declarations');
    expect(readsTopLevelWatching({ watching: ['JPM'] }, ['MU'])).toBe(false);
  });

  it('no block at all (absent / null) + a top-level list → a WATCHING-ONLY declaration: the list kept, no call, phase expected', () => {
    for (const block of [undefined, null]) {
      const r = run(block, { topLevelWatching: ['MU', 'GME'] });
      expect(r.validated).toEqual({ calledShots: [], watching: ['MU', 'GME'], playerAsk: null, fork: null });
      expect(r.calls).toEqual([]);
      expect(r.phase).toBe('expected');
      expect(r.watchingSource).toBe('top_level');
      expect(r.removed).toEqual([]);
    }
  });

  it('a block with shots and no list, or an EMPTY list, reads the top-level list beside its shots', () => {
    for (const block of [{ calledShots: [shot()] }, { calledShots: [shot()], watching: [] }, { calledShots: [shot()], watching: null }]) {
      const r = run(block, { topLevelWatching: ['MU'] });
      expect(r.validated.calledShots).toHaveLength(1);
      expect(r.validated.watching).toEqual(['MU']);
      expect(r.watchingSource).toBe('top_level');
      expect(r.calls.map((c) => c.kind)).toEqual(['called_shot']);
    }
  });

  it('a block whose own list is MALFORMED (not an array) records that removal and hands over to the top-level list', () => {
    const r = run({ watching: 'MU' }, { topLevelWatching: ['GME'] });
    expect(r.removed).toEqual([{ source: 'watching', index: null, reason: 'malformed' }]);
    expect(r.validated.watching).toEqual(['GME']);
    expect(r.watchingSource).toBe('top_level');
  });

  it('a block whose own list is a NON-EMPTY array keeps it — even when every entry is malformed (the top level is not read)', () => {
    const r = run({ calledShots: [shot()], watching: ['', '  '] }, { topLevelWatching: ['GME'] });
    expect(r.validated.watching).toEqual([]);
    expect(r.watchingSource).toBeNull();
    expect(r.removed).toEqual([{ source: 'watching', index: 0, reason: 'malformed' }, { source: 'watching', index: 1, reason: 'malformed' }]);
  });

  it('a top-level value that is not an array is never read, and leaves no trace', () => {
    for (const top of ['MU', { 0: 'MU' }, 7, true, undefined, null]) {
      const r = run(null, { topLevelWatching: top });
      expect(r, String(top)).toEqual({ validated: null, removed: [], calls: [], phase: 'none', watchingSource: null });
    }
  });

  it('the top-level list is judged by EXACTLY the block-list rules: non-empty strings, order kept, the cap of 6', () => {
    const r = run(null, { topLevelWatching: ['MU', '', 'GME', 3, 'AMAT', 'KLAC', 'LRCX', 'TXN', 'NVDA'] });
    expect(r.validated.watching).toEqual(['MU', 'GME', 'AMAT', 'KLAC', 'LRCX', 'TXN']);
    expect(r.removed).toEqual([
      { source: 'watching', index: 1, reason: 'malformed' },
      { source: 'watching', index: 3, reason: 'malformed' },
      { source: 'watching', index: 8, reason: 'oversize' },
    ]);
    expect(DECLARATION_CAPS.watching).toBe(6);
    // The same entries inside the block are judged identically (one rule, two sources).
    const inBlock = run({ watching: ['MU', '', 'GME', 3, 'AMAT', 'KLAC', 'LRCX', 'TXN', 'NVDA'] });
    expect(inBlock.validated.watching).toEqual(r.validated.watching);
    expect(inBlock.removed).toEqual(r.removed);
  });

  it('HEAD rule, recorded: neither list is checked against the universe nor de-duplicated (C-1 says "exactly the rules that apply")', () => {
    const top = run(null, { topLevelWatching: ['MU', 'MU', 'NOT-A-TICKER'] });
    const block = run({ watching: ['MU', 'MU', 'NOT-A-TICKER'] });
    expect(top.validated.watching).toEqual(['MU', 'MU', 'NOT-A-TICKER']);
    expect(block.validated.watching).toEqual(top.validated.watching);
  });

  it('a NON-OBJECT block + a usable top-level list: the malformed_block removal is recorded, and the list stands alone', () => {
    const r = run('declarations-as-a-string', { topLevelWatching: ['MU'] });
    expect(r.removed).toEqual([{ source: 'block', index: null, reason: 'malformed_block' }]);
    expect(r.validated.watching).toEqual(['MU']);
    expect(r.calls).toEqual([]);
    expect(r.watchingSource).toBe('top_level');
  });

  it('captureDeclarations detaches the top-level list (a later mutation of the tool input cannot reach it) and carries it beside raw', () => {
    const input = { declarations: null, watching: ['MU', 'GME'] };
    const captured = captureDeclarations(input.declarations, { universe: UNIVERSE, topLevelWatching: input.watching });
    input.watching.push('AMAT');
    input.watching[0] = 'XXX';
    expect(captured.topLevelWatching).toEqual(['MU', 'GME']);
    expect(captured.phase).toBe('expected');
    expect(captured.validation.watchingSource).toBe('top_level');
    // Nothing given → nothing carried, HEAD behaviour.
    expect(captureDeclarations(makeDeclarations(), { universe: UNIVERSE }).topLevelWatching).toBeUndefined();
  });

  it('only `watching` is read from the top level: the cron hands the validator the declarations object and the top-level watching, nothing else', () => {
    const call = CRON.slice(CRON.indexOf('callsCtx.declarations = captureDeclarations('), CRON.indexOf('callsCtx.declarations = captureDeclarations(') + 600);
    expect(call).toContain('captureDeclarations(toolUse.input?.declarations, {');
    expect(call).toContain('topLevelWatching: toolUse.input?.watching,');
    expect(CRON).not.toMatch(/toolUse\.input\?\.(fork|playerAsk)\b/);
    expect(CRON.match(/topLevelWatching:/g)).toHaveLength(1);
  });

  it('capture happens only on an ACCEPTED trade result, as before (inside the `validation.valid` branch)', () => {
    const at = CRON.indexOf('callsCtx.declarations = captureDeclarations(');
    const validBranch = CRON.lastIndexOf('if (validation.valid) {', at);
    const nextElse = CRON.indexOf('} else if (!toolUse) {', validBranch);
    expect(validBranch).toBeGreaterThan(0);
    expect(at).toBeGreaterThan(validBranch);
    expect(at).toBeLessThan(nextElse);
  });

  it('the mint re-judges the SAME inputs: a watching-only candidate has a record (watchingSource top_level), no call, nothing open', () => {
    const c = mint(null, { topLevelWatching: ['MU', 'GME'] });
    expect(c.calls).toEqual([]);
    expect(c.newOpen).toEqual([]);
    expect(c.record.watching).toEqual(['MU', 'GME']);
    expect(c.record.watchingSource).toBe('top_level');
    expect(c.record.minted).toEqual([]);
  });

  it('watchingSource is null on a record that keeps no list (shots only), and one of the two values otherwise', () => {
    expect(mint({ calledShots: makeDeclarations().calledShots }).record.watchingSource).toBeNull();
    expect(mint(makeDeclarations()).record.watchingSource).toBe('declarations');
    expect(WATCHING_SOURCES).toEqual(['declarations', 'top_level']);
  });

  it('end to end through the model-path phase: a top-level-only check WRITES its declarations record and mints no call; no declared event even at on', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(MINT);
    try {
      const db = makeCallsDb({ battle: committedBattle() });
      const ctx = createCallsContext({ mode: 'on', handlerStartMs: MINT - 60_000 });
      ctx.universe = Object.freeze([...UNIVERSE]);
      ctx.held = Object.freeze([...HELD]);
      ctx.observation = makeObservation();
      ctx.declarations = captureDeclarations(null, {
        universe: ctx.universe,
        resolveHorizon: bindHorizon({ promptBuiltAtMs: PROMPT_MS, mintedAtMs: MINT, battleExpiresAtMs: battleExpiryMs(committedBattle()) }),
        topLevelWatching: ['MU', 'GME'],
      });
      ctx.exit = 'model_result';
      ctx.evalIdentity = { evalId: EVAL_ID, evalSeq: 1 };
      const res = await runModelCallsPhase(ctx, { db, battle: committedBattle(), timeBudgetMs: TIME_BUDGET_MS, promptBuiltAt: FROZEN_NOW, tickId: null });
      expect(res).toMatchObject({ phaseResult: 'written', wire: 'written' });
      const record = storedDoc(db, 'declarations', EVAL_ID);
      expect(record).toMatchObject({ watching: ['MU', 'GME'], watchingSource: 'top_level', mintedMode: 'on', calledShots: [], minted: [] });
      expect(Object.keys(storedCollection(db, 'calls'))).toEqual([]);
      expect(Object.keys(storedCollection(db, 'callEvents'))).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
describe('C-2 — heldAtMint, from the held set frozen at the model seam', () => {
  it('the model seam freezes the held set beside the universe (the observation itself keeps no held/bench split)', () => {
    const ctx = createCallsContext({ mode: 'shadow', handlerStartMs: 1 });
    freezeModelObservation(ctx, { heldSymbols: ['NVDA', 'TSLA', '', null], benchSymbols: ['AMD'], promptBuiltAt: FROZEN_NOW, replacedSymbols: [], battle: makeTickBattle() });
    expect(ctx.held).toEqual(['NVDA', 'TSLA']);
    expect(Object.isFrozen(ctx.held)).toBe(true);
    expect(ctx.observation.symbols).not.toHaveProperty('held');
    // Inactive mode: nothing is touched.
    const off = createCallsContext({ mode: 'off', handlerStartMs: 1 });
    freezeModelObservation(off, { heldSymbols: ['NVDA'], benchSymbols: [], promptBuiltAt: FROZEN_NOW, replacedSymbols: [], battle: makeTickBattle() });
    expect(off.held).toBeNull();
  });

  it('an ENTRY on a held name is an upside call (true); an entry on a bench name is not; an exit never is', () => {
    const c = mint({ calledShots: [
      shot({ symbol: 'TSLA', direction: 'entry', slot: 'star', counterpart: undefined, condition: { side: 'above', level: 250 } }),
      shot({ symbol: 'AMD', direction: 'entry' }),
      shot({ symbol: 'NVDA', direction: 'exit', slot: 'star', counterpart: undefined, condition: { side: 'below', level: 100 } }),
    ] });
    expect(c.calls.map((x) => [x.symbol, x.direction, x.heldAtMint])).toEqual([['TSLA', 'entry', true], ['AMD', 'entry', false], ['NVDA', 'exit', false]]);
  });

  it('a pick carries no heldAtMint (C-2 names shots and confirmations only); readers read its absence as false', () => {
    const c = mint({ fork: { slot: 'support', swapOut: 'KO', options: [{ symbol: 'AMD', why: 'a' }, { symbol: 'JPM', why: 'b' }], said: 'AMD or JPM?' } });
    expect(c.calls[0].kind).toBe('pick');
    expect(c.calls[0]).not.toHaveProperty('heldAtMint');
  });

  it('the held set is REQUIRED: omitted → throws; null (the explicit "unknown") → heldAtMint false and no counterpart usable', () => {
    expect(() => buildMintCandidate({
      battleId: BATTLE_ID, evalId: EVAL_ID, evalSeq: 1, mintedAtMs: MINT, raw: makeDeclarations(), universe: UNIVERSE,
      observation: makeObservation(), promptBuiltAt: FROZEN_NOW, tickId: null, battle: committedBattle(), mintedMode: 'shadow',
    })).toThrow(/held/);
    const c = mint({ calledShots: [shot({ symbol: 'TSLA', counterpart: 'KO', condition: { side: 'above', level: 250 } })] }, { held: null });
    expect(c.calls[0].heldAtMint).toBe(false);
    expect(c.calls[0].counterpart).toBeNull();
    expect(c.calls[0].counterpartRaw).toBe('KO');
  });

  it('held-ness is never inferred from prompt text: a `said` that calls the name held changes nothing', () => {
    const c = mint({ calledShots: [shot({ symbol: 'AMD', said: 'AMD is already held in my book; adding above $163.50.' })] });
    expect(c.calls[0].heldAtMint).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('C-3 — counterpart usability (the discovery\'s D-B5 classes)', () => {
  const one = (row) => mint({ calledShots: [row] }).calls[0];
  const exit = (counterpart) => shot({ symbol: 'NVDA', direction: 'exit', slot: 'star', counterpart, condition: { side: 'below', level: 100 } });
  const entry = (counterpart) => shot({ symbol: 'AMD', direction: 'entry', slot: 'support', counterpart });

  it.each([
    ['TBD', 'TBD'], ['entry', 'entry'], ['N/A', 'N/A'], ['undecided', 'undecided'], ['SNOW or INTC', 'SNOW or INTC'], ['AMD or MAR', 'AMD or MAR'],
  ])('exit: %s (not a universe name) → counterpart null, counterpartRaw kept', (cp, raw) => {
    const call = one(exit(cp));
    expect(call.counterpart).toBeNull();
    expect(call.counterpartRaw).toBe(raw);
  });

  it('exit: the call\'s OWN symbol → unusable', () => {
    expect(one(exit('NVDA'))).toMatchObject({ counterpart: null, counterpartRaw: 'NVDA' });
  });

  it('exit: a HELD name (it cannot be brought in) → unusable', () => {
    expect(one(exit('KO'))).toMatchObject({ counterpart: null, counterpartRaw: 'KO' });
  });

  it('exit: a universe name not held → USABLE, kept, counterpartRaw null (with no lock known)', () => {
    expect(one(exit('JPM'))).toMatchObject({ counterpart: 'JPM', counterpartRaw: null });
    expect(one(exit('AMD'))).toMatchObject({ counterpart: 'AMD', counterpartRaw: null });
  });

  it('exit: a bench name COOLDOWN-LOCKED at the seam → unusable (C-3 "not cooldown-locked where the seam knows lock status" — review L1-3)', () => {
    const call = mint({ calledShots: [exit('AMD')] }, { locked: ['AMD'] }).calls[0];
    expect(call).toMatchObject({ counterpart: null, counterpartRaw: 'AMD' });
    // Lock status unknown (null) excludes nothing; a lock on ANOTHER name changes nothing.
    expect(mint({ calledShots: [exit('AMD')] }, { locked: null }).calls[0].counterpart).toBe('AMD');
    expect(mint({ calledShots: [exit('AMD')] }, { locked: ['JPM'] }).calls[0].counterpart).toBe('AMD');
    // The lock clause is an EXIT rule: an entry's counterpart is a held name, never a bench one.
    expect(mint({ calledShots: [entry('KO')] }, { locked: ['KO'] }).calls[0].counterpart).toBe('KO');
  });

  it('the seam freezes the lock set from the very bench the prompt rendered, at promptBuiltAt — cooldownUntil after it is locked, before it is not; the hot bench never is', () => {
    const battle = makeTickBattle();
    battle.portfolio = {
      ...battle.portfolio,
      bench: {
        stocks: [
          { symbol: 'AMD', cooldownUntil: new Date(PROMPT_MS + 3_600_000).toISOString() },
          { symbol: 'JPM', cooldownUntil: new Date(PROMPT_MS - 1).toISOString() },
          { symbol: 'PG' },
        ],
        crypto: { symbol: 'BTC', cooldownUntil: new Date(PROMPT_MS + 60_000).toISOString() },
      },
    };
    battle.watchlist = { hotBench: ['MSFT'] };
    expect(benchCooldownLocked(battle, PROMPT_MS)).toEqual(['AMD', 'BTC']);
    expect(benchCooldownLocked(battle, Number.NaN)).toBeNull();
    const ctx = createCallsContext({ mode: 'shadow', handlerStartMs: 1 });
    freezeModelObservation(ctx, { heldSymbols: ['NVDA'], benchSymbols: ['AMD', 'JPM', 'PG', 'BTC'], promptBuiltAt: FROZEN_NOW, replacedSymbols: [], battle });
    expect(ctx.locked).toEqual(['AMD', 'BTC']);
    expect(Object.isFrozen(ctx.locked)).toBe(true);
    const unreadable = createCallsContext({ mode: 'shadow', handlerStartMs: 1 });
    freezeModelObservation(unreadable, { heldSymbols: [], benchSymbols: [], promptBuiltAt: 'not a time', replacedSymbols: [], battle });
    expect(unreadable.locked).toBeNull();
    const off = createCallsContext({ mode: 'off', handlerStartMs: 1 });
    freezeModelObservation(off, { heldSymbols: [], benchSymbols: [], promptBuiltAt: FROZEN_NOW, replacedSymbols: [], battle });
    expect(off.locked).toBeNull();
  });

  it('entry: a HELD name other than the own symbol (the position it would replace) → USABLE, kept', () => {
    expect(one(entry('KO'))).toMatchObject({ counterpart: 'KO', counterpartRaw: null });
  });

  it('entry: a non-held name, the own symbol, or a non-name → unusable', () => {
    expect(one(entry('JPM'))).toMatchObject({ counterpart: null, counterpartRaw: 'JPM' });
    expect(one(entry('AMD'))).toMatchObject({ counterpart: null, counterpartRaw: 'AMD' });
    expect(one(entry('N/A'))).toMatchObject({ counterpart: null, counterpartRaw: 'N/A' });
  });

  it('absent → both null; exact membership only (a near-miss spelling is not the name)', () => {
    expect(one(exit(undefined))).toMatchObject({ counterpart: null, counterpartRaw: null });
    expect(one(exit('jpm'))).toMatchObject({ counterpart: null, counterpartRaw: 'jpm' });
    expect(one(exit('JPM '))).toMatchObject({ counterpart: null, counterpartRaw: 'JPM ' });
  });

  it('counterpartRaw is cut to 40 code points, never splitting a surrogate pair', () => {
    const long = 'X'.repeat(39) + '📈' + 'tail';
    const call = one(exit(long));
    expect(call.counterpartRaw).toBe('X'.repeat(39) + '📈');
    expect([...call.counterpartRaw]).toHaveLength(COUNTERPART_RAW_MAX);
    expect(counterpartRawOf('short')).toBe('short');
  });

  it('counterpartUsable is the one rule; an unknown seam proves nothing', () => {
    expect(counterpartUsable({ symbol: 'NVDA', direction: 'exit', counterpart: 'JPM' }, { held: HELD, universe: UNIVERSE })).toBe(true);
    expect(counterpartUsable({ symbol: 'NVDA', direction: 'exit', counterpart: 'JPM' }, { held: null, universe: UNIVERSE })).toBe(false);
    expect(counterpartUsable({ symbol: 'NVDA', direction: 'exit', counterpart: 'JPM' }, { held: HELD, universe: null })).toBe(false);
    expect(counterpartUsable({ symbol: 'NVDA', direction: 'exit', counterpart: 'JPM' }, { held: HELD, universe: UNIVERSE, locked: ['JPM'] })).toBe(false);
  });

  // C-3 changes what `counterpart` MEANS for its non-renderer consumers too
  // (review L1-5 / L2-2, disclosed in the build report): each is pinned here
  // so the change is a decision, not a side effect. All three act only at
  // shadow / on — nothing here runs at 'off'.
  it('consumer 1 — the canonical call_go text the model reads: an UNUSABLE counterpart is not named ("…exit." rather than "…exit for TBD.")', () => {
    const tbd = one(exit('TBD'));
    const jpm = one(exit('JPM'));
    const now = MINT + 1000;
    expect(renderCallActionText('call_go', tbd, { nowMs: now })).toMatch(/go ahead and exit\.$/);
    expect(renderCallActionText('call_go', jpm, { nowMs: now })).toMatch(/go ahead and exit for JPM\.$/);
  });

  it('consumer 2 — the acted match: a nulled counterpart no longer blocks a whole-trade match on the call\'s own leg', () => {
    const tbd = one(exit('TBD'));
    const observation = { observedAtMs: MINT + 60_000, source: 'model_prompt', symbols: { NVDA: { px: 120 } } };
    const executorResult = { type: 'swap', symbolOut: 'NVDA', symbolIn: 'AMD', tier: 'star', slotIndex: 0 };
    const plan = planFlip({ ...tbd, state: 'open' }, { observation, evalId: 'eval_002', executorResult });
    expect(plan).toMatchObject({ acted: true });
  });

  it('consumer 3 — go_now eligibility on an ENTRY: a nulled (unusable) counterpart no longer refuses counterpart_not_held', () => {
    const jpm = one(entry('JPM')); // JPM is not held → C-3 nulls it
    expect(jpm.counterpart).toBeNull();
    const battle = committedBattle();
    expect(isCallActionEligible('call_go', jpm, battle)).toEqual({ ok: true });
    expect(isCallActionEligible('call_go', { ...jpm, counterpart: 'JPM' }, battle)).toEqual({ ok: false, reason: 'counterpart_not_held' });
  });

  // Amendment C revision 3 (founder ruling Oct 5; 2A P2-3): the rest of each
  // consumer, so every claim of the knock-on bullets is pinned here.
  it('rev 3 — the rest of each consumer: the call_hold text never names a counterpart; legality has no counterpart dimension and counterpart_not_held refuses call_hold too; on an ENTRY a nulled counterpart matches whatever goes out', () => {
    const now = MINT + 1000;
    const hold = renderCallActionText('call_hold', one(exit('JPM')), { nowMs: now });
    expect(hold).toMatch(/^Hold off on the NVDA exit until /);
    expect(hold).not.toMatch(/JPM/);
    expect(renderCallActionText('call_hold', one(exit('TBD')), { nowMs: now })).toBe(hold);
    const nulled = one(entry('JPM')); // JPM is not held → C-3 nulls it
    expect(nulled.counterpart).toBeNull();
    const named = { ...nulled, counterpart: 'JPM' };
    expect(classifyAnswer(nulled, 'hold')).toBe('directive');
    expect(classifyAnswer({ ...nulled, defaultAction: 'hold' }, 'go_now')).toBe('directive');
    // Every default, direction and kind: a nulled counterpart and a named one classify every 1a answer alike (review Q4-2).
    for (const defaultAction of ['act', 'hold']) for (const direction of ['entry', 'exit']) for (const kind of ['called_shot', 'confirmation']) {
      const base = { ...nulled, defaultAction, direction, kind };
      for (const answer of ANSWERS_1A) expect(classifyAnswer(base, answer), `${defaultAction}/${direction}/${kind}/${answer}`).toBe(classifyAnswer({ ...base, counterpart: 'JPM' }, answer));
    }
    const battle = committedBattle();
    expect(isCallActionEligible('call_hold', nulled, battle)).toEqual({ ok: true });
    expect(isCallActionEligible('call_hold', named, battle)).toEqual({ ok: false, reason: 'counterpart_not_held' });
    const amdInForPg = { type: 'swap', symbolIn: 'AMD', symbolOut: 'PG', tier: 'support', slotIndex: 1 };
    expect(matchesWholeTrade(nulled, amdInForPg)).toBe(true);
    expect(matchesWholeTrade({ ...nulled, counterpart: 'KO' }, amdInForPg)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('C-4 — saidOk per call, the lint\'s own verdict', () => {
  it('each call carries saidPassesLint(said, basis) — true, false, and a pick under next_check', () => {
    const c = mint({
      calledShots: [
        shot({ said: 'AMD above $163.50 by the close.' }),
        shot({ symbol: 'AMD', said: 'AMD above $163.50 on strong volume.' }),
      ],
      fork: { slot: 'support', swapOut: 'KO', options: [{ symbol: 'AMD', why: 'a' }, { symbol: 'JPM', why: 'b' }], said: 'AMD or JPM by the close?' },
    });
    for (const call of c.calls) expect(call.saidOk, call.callId).toBe(saidPassesLint(call.said, call.horizon.basis));
    expect(c.calls.map((x) => x.saidOk)).toEqual([true, false, false]);
  });

  it('a call with nothing said reads null (saidOkOf)', () => {
    expect(saidOkOf(undefined, 'this_session')).toBeNull();
    expect(saidOkOf('   ', 'this_session')).toBeNull();
    expect(saidOkOf('AMD above $1.', 'this_session')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('C-5 — mintedMode on calls and the declarations record', () => {
  it('both documents carry the mode they were minted under', () => {
    for (const mode of ['shadow', 'on']) {
      const c = mint(makeDeclarations(), { mintedMode: mode });
      expect(c.record.mintedMode).toBe(mode);
      for (const call of c.calls) expect(call.mintedMode).toBe(mode);
    }
    expect(MINTED_MODES).toEqual(['shadow', 'on']);
  });

  it('the mode is REQUIRED and only the two minting modes are accepted', () => {
    for (const bad of [undefined, 'off', 'ON', null]) expect(() => mint(makeDeclarations(), { mintedMode: bad }), String(bad)).toThrow(/mintedMode/);
  });

  it('the model-path phase stamps the RESOLVED mode it ran under (on → on)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(MINT);
    try {
      const db = makeCallsDb({ battle: committedBattle() });
      const ctx = createCallsContext({ mode: 'on', handlerStartMs: MINT - 60_000 });
      ctx.universe = Object.freeze([...UNIVERSE]);
      ctx.held = Object.freeze([...HELD]);
      ctx.observation = makeObservation();
      ctx.declarations = captureDeclarations(makeDeclarations(), {
        universe: ctx.universe,
        resolveHorizon: bindHorizon({ promptBuiltAtMs: PROMPT_MS, mintedAtMs: MINT, battleExpiresAtMs: battleExpiryMs(committedBattle()) }),
      });
      ctx.exit = 'model_result';
      ctx.evalIdentity = { evalId: EVAL_ID, evalSeq: 1 };
      await runModelCallsPhase(ctx, { db, battle: committedBattle(), timeBudgetMs: TIME_BUDGET_MS, promptBuiltAt: FROZEN_NOW, tickId: null });
      expect(storedDoc(db, 'declarations', EVAL_ID).mintedMode).toBe('on');
      const calls = Object.values(storedCollection(db, 'calls'));
      expect(calls).toHaveLength(2);
      for (const call of calls) expect(call.mintedMode).toBe('on');
      // The seam facts reached the mint: AMD (bench) is no upside call, KO (held) is its usable counterpart.
      expect(calls.find((x) => x.symbol === 'AMD')).toMatchObject({ heldAtMint: false, counterpart: 'KO', counterpartRaw: null, saidOk: true });
    } finally {
      vi.useRealTimers();
    }
  });
});

beforeEach(() => { vi.useRealTimers(); });
