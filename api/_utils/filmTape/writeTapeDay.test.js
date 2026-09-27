// api/_utils/filmTape/writeTapeDay.test.js
//
// Film Room tape — the close pass's writer (spec §4, BA-1 … BA-22), driven
// against the fixture battle-days in __fixtures__/tapeFixtures.js through an
// in-memory Firestore that records every read and write.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL import of
// writeTapeDay.js is the runtime guard for its transitive surface — including
// src/constants/filmTape.js and src/constants/agentGameModes.js, which api/
// imports under the §4 rule. Never mock that import. (The flag module is
// mocked by spreading the real one, so its graph still loads.)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));

import { writeTapeDay, markCloseFailed } from './writeTapeDay.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import {
  seedDay, capturedDay, noTriggerDay, budgetDay, completedDay, multiDay, skippedModeDay, preCaptureDay,
} from './__fixtures__/tapeFixtures.js';
import { numbersWithClasses, formatNumberPath, COVERAGE_SECTIONS, PROVENANCE_CLASSES } from '../../../src/constants/filmTape.js';
import { stableStringify } from './tapeMerge.js';

const NOW = Date.parse('2026-09-25T02:15:30.000Z'); // the close pass for 2026-09-24
const tapePath = (battleId, etDate) => `agentBattles/${battleId}/tape/${etDate}`;

async function world(fx, { hooks } = {}) {
  const t = makeTapeDb(seedDay({}, fx), { hooks });
  return t;
}
async function writeFor(fx, opts = {}) {
  const t = await world(fx, opts);
  const r = await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: opts.now ?? NOW });
  return { ...t, r, tape: t.store.get(tapePath(fx.battleId, fx.etDate)) };
}

beforeEach(() => { flags.writer = true; });

describe('the §4 document', () => {
  it('has every top-level field, both passes, and a coverage object (BA-20) for every section', async () => {
    const { tape, r } = await writeFor(await capturedDay());
    expect(r.status).toBe('written');
    for (const k of ['tapeVersion', 'battleId', 'ownerId', 'agentId', 'archetype', 'gameMode', 'etDate', 'dayNumber', 'isFinalDay', 'battleStatusAtWrite',
      'writtenAt', 'firstWrittenAt', 'runCount', 'passes', 'coverage', 'score', 'battle', 'checks', 'actions', 'directives', 'plans', 'calls', 'rationale',
      'comparables', 'diagnostics', 'numberClasses']) expect(tape, k).toHaveProperty(k);
    expect(tape.tapeVersion).toBe(2);
    expect(tape.ownerId).toBe('owner-1');
    expect(Object.keys(tape.passes.close).sort()).toEqual(['capture', 'deferralsTruncated', 'gaps', 'lastError', 'sources', 'status', 'tickSeqRange', 'ticksReadMethod', 'unattributedGaps', 'writtenAt'].sort());
    expect(Object.keys(tape.passes.close.sources).sort()).toEqual(['calls', 'declarations', 'evaluations', 'receipts', 'runs', 'ticks', 'trades']);
    expect(Object.keys(tape.passes.candles).sort()).toEqual(['attempts', 'reason', 'source', 'status', 'symbolsMissing', 'symbolsRequested', 'writtenAt']);
    expect(Object.keys(tape.coverage).sort()).toEqual([...COVERAGE_SECTIONS].sort());
    for (const s of COVERAGE_SECTIONS) {
      expect(Object.keys(tape.coverage[s]).sort(), s).toEqual(['note', 'preservedFrom', 'sources', 'span', 'status']);
      expect(['complete', 'partial', 'unavailable']).toContain(tape.coverage[s].status);
    }
    expect(Object.keys(tape.score).sort()).toEqual(['dayChange', 'firstCheck', 'lastCheck']);
    expect(Object.keys(tape.battle).sort()).toEqual(['completedAt', 'final', 'result', 'status']);
    expect(tape.comparables.market).toEqual(['SPY', 'RSP']);
    expect(tape.diagnostics).toEqual({ intradayViews: 'absent' });
  });

  it('every number in the document carries exactly one of the four classes (BA-21) — on every fixture', async () => {
    const fixtures = [await capturedDay(), await noTriggerDay(), await budgetDay(), await completedDay(), await skippedModeDay(), preCaptureDay()];
    const m = await multiDay();
    for (const d of m.days) fixtures.push({ ...m, etDate: d });
    for (const fx of fixtures) {
      const { tape } = await writeFor(fx);
      const nums = numbersWithClasses(tape, tape.numberClasses);
      expect(nums.length).toBeGreaterThan(0);
      const unclassed = nums.filter((n) => !PROVENANCE_CLASSES.includes(n.cls)).map((n) => formatNumberPath(n.path));
      expect(unclassed, `${fx.battleId} ${fx.etDate}`).toEqual([]);
    }
  });
});

describe('checks (BA-7, BA-8)', () => {
  it('records every check state the day produced — including a deferral from agentEvalRuns and a minted-but-missing check', async () => {
    const { tape } = await writeFor(await capturedDay());
    const states = new Set(tape.checks.map((c) => c.state));
    for (const s of ['no_trigger', 'completed', 'budget_skipped', 'deferred', 'gameplan_pending', 'degraded_quotes', 'no_record']) expect(states, s).toContain(s);
    const deferred = tape.checks.filter((c) => c.state === 'deferred');
    expect(deferred).toHaveLength(1);
    expect(deferred[0]).toMatchObject({ tickSeq: null, runId: '2026-09-24T15:00:00.000Z', at: '2026-09-24T15:00:00.000Z' });
    const gap = tape.checks.find((c) => c.state === 'no_record');
    expect(gap).toMatchObject({ tickSeq: 13, at: null, tickId: 'b-captured:13' });
    expect(tape.passes.close.gaps).toEqual([13]);
    expect(tape.passes.close.capture).toBe('partial');
  });

  it('a truncated deferral list is RECORDED (deferralsTruncated) and named at the checks section — never read as "no deferrals"', async () => {
    const { tape } = await writeFor(await capturedDay());
    expect(tape.passes.close.deferralsTruncated).toBe(true);
    expect(tape.coverage.checks.status).toBe('partial');
    expect(tape.coverage.checks.note).toMatch(/truncated/);
  });

  it('BA-7: a check with no risk record has risk null (distinct from HOLD); a recorded verdict is copied as {action, reason}', async () => {
    const { tape } = await writeFor(await capturedDay());
    expect(tape.checks.find((c) => c.state === 'degraded_quotes').risk).toBeNull();
    const five = tape.checks.find((c) => c.tickSeq === 5);
    expect(five.risk.AMD).toEqual({ action: 'EMERGENCY_SWAP', reason: 'bust_avoidance' });
    expect(five.risk.AAPL).toEqual({ action: 'HOLD', reason: null });
  });

  it('copies the evidence stamp per check from evaluations[].evidence with evidenceAt = the entry\'s promptBuiltAt', async () => {
    const fx = await capturedDay();
    const { tape } = await writeFor(fx);
    const entry = fx.battle.evaluations.find((e) => e.evalId === 'b-captured:e6');
    const row = tape.checks.find((c) => c.evalId === 'b-captured:e6');
    expect(row.evidence).toEqual(entry.evidence);
    expect(row.evidenceAt).toBe(entry.promptBuiltAt);
    expect(row.tickMs).toBe(entry.tickMs);
    // a budget-skipped entry has no stamps (the gate is promptBuilt) — no evidence, no evidenceAt
    const skipped = tape.checks.find((c) => c.state === 'budget_skipped');
    expect(skipped.evidence).toBeNull();
    expect(skipped.evidenceAt).toBeNull();
  });

  it('a no_trigger-heavy clean day: every row accounted for, checks coverage complete', async () => {
    const { tape } = await writeFor(await noTriggerDay());
    expect(tape.checks.filter((c) => c.state === 'no_trigger')).toHaveLength(25);
    expect(tape.checks.filter((c) => c.state === 'completed')).toHaveLength(1);
    expect(tape.passes.close.capture).toBe('present');
    expect(tape.coverage.checks.status).toBe('complete');
    expect(tape.coverage.checks.span).toEqual({ from: '2026-09-24T13:30:20.000Z', to: '2026-09-24T19:45:20.000Z' });
  });

  it('a pre-capture day: capture absent, checks from evaluations[] only — never rendered as inactivity', async () => {
    const { tape } = await writeFor(preCaptureDay());
    expect(tape.passes.close.capture).toBe('absent');
    expect(tape.checks).toHaveLength(2);
    expect(tape.checks.every((c) => c.rowSource === 'entry' && c.tickSeq === null)).toBe(true);
    expect(tape.coverage.checks.status).toBe('partial');
    expect(tape.coverage.checks.note).toMatch(/capture absent/);
    // the swap still appears, from trades[]
    expect(tape.actions).toHaveLength(1);
    expect(tape.actions[0]).toMatchObject({ rowSource: 'trade', actionId: null, tradeMatched: true, receiptMatched: false });
  });

  it('the budget_skipped day: skipped checks by name; the platform\'s placeholder text is not copied as the agent\'s words', async () => {
    const { tape } = await writeFor(await budgetDay());
    expect(tape.checks.filter((c) => c.state === 'budget_skipped')).toHaveLength(3);
    expect(tape.rationale).toEqual([]);
    expect(tape.coverage.rationale.note).toMatch(/platform-written placeholder/);
  });
});

describe('actions (BA-5, BA-6) and the replay inputs', () => {
  it('come from ticks.actions[], joined to trades[] and the receipt; who made the exit by the line that fired', async () => {
    const fx = await capturedDay();
    const { tape } = await writeFor(fx);
    expect(tape.actions).toHaveLength(2);
    const [risk, model] = tape.actions;
    expect(risk).toMatchObject({
      actionId: 'b-captured:5:1', tickSeq: 5, rowSource: 'tick', source: 'risk_manager', exitReason: 'bust_avoidance', mechanism: 'platform_risk_manager',
      symbolOut: 'AMD', symbolIn: 'TSLA', tier: 'core', slotIndex: 1, entryPrice: 150, exitPrice: 144.2, lockedPoints: -12.5, lockedGainPct: -3.867,
      tradeMatched: true, receiptMatched: true, inBasis: { price: 240, at: fx.swapRisk.at }, subsequentTradesInSlot: 0, replay: null, replayReason: null,
    });
    expect(model).toMatchObject({ mechanism: 'agent_decision', exitReason: 'haiku_decision', symbolOut: 'MSFT', symbolIn: 'NFLX' });
    // holding time: the swap instant minus the recorded entry instant (held from the start → activation)
    expect(risk.holdingBasis).toBe('battle_activated_at');
    expect(risk.holdingMs).toBe(Date.parse(fx.swapRisk.at) - Date.parse(fx.battle.activatedAt));
  });

  it('replayInputs name both legs\' scorer inputs and where each came from', async () => {
    const { tape } = await writeFor(await capturedDay());
    const { ghost, bought } = tape.actions[0].replayInputs;
    expect(ghost).toMatchObject({ entryPrice: 150, atr: 3.1, tier: 'core', thresholdHistory: { maxMultiplier: 0.4, minMultiplier: -1.2 }, thresholdBaseline: { value: 150, basis: 'starting_price' } });
    expect(ghost.sources).toMatchObject({ entryPrice: 'ticks.actions.entryPrice', atr: 'receipt.guardrailReplay.outgoingBaseATR', tier: 'trades.tier', thresholdHistory: 'receipt.guardrailReplay.thresholdHistory' });
    expect(bought).toMatchObject({ entryPrice: 240, atr: 4.2, tier: 'core', thresholdHistory: { maxMultiplier: 0, minMultiplier: 0 }, thresholdBaseline: { value: 240, basis: 'swap_price' } });
    expect(tape.actions[0].replayMissing).toEqual([]);
  });

  it('an action with no matching trade is still an action (tradeMatched false); no receipt → both legs null, inputs named', async () => {
    const fx = await capturedDay();
    fx.battle.trades = [];
    fx.receipts = [];
    const { tape } = await writeFor(fx);
    expect(tape.actions).toHaveLength(2);
    expect(tape.actions[0]).toMatchObject({ tradeMatched: false, receiptMatched: false, exitPrice: null, tier: null, holdingMs: null, inBasis: null });
    expect(tape.actions[0].replayInputs).toEqual({ ghost: null, bought: null });
    expect(tape.actions[0].replayMissing).toEqual(expect.arrayContaining(['ghost.atr', 'ghost.tier', 'ghost.thresholdHistory', 'bought.entryPrice', 'bought.atr']));
  });

  it('an original pick sold on a non-activation day: the baseline is the unrecorded previousClose — the ghost leg is null, never guessed', async () => {
    const fx = await capturedDay();
    fx.battle.activatedAt = '2026-09-23T23:00:00.000Z'; // deployed the evening before (ET 2026-09-23)
    const { tape } = await writeFor(fx);
    expect(tape.actions[0].replayInputs.ghost).toBeNull();
    expect(tape.actions[0].replayMissing).toEqual(['ghost.thresholdBaseline']);
    expect(tape.actions[0].replayInputs.bought).not.toBeNull();
  });

  it('a position swapped in the same day scores against its swapPrice: baseline = the recorded entry, basis swap_price', async () => {
    const fx = await capturedDay();
    fx.battle.activatedAt = '2026-09-23T23:00:00.000Z';
    fx.receipts[1].guardrailReplay.outgoingSwappedInDay = 1;
    fx.receipts[1].guardrailReplay.outgoingSwappedInAt = '2026-09-24T14:00:00.000Z';
    const { tape } = await writeFor(fx);
    expect(tape.actions[1].replayInputs.ghost.thresholdBaseline).toEqual({ value: 420, basis: 'swap_price' });
    expect(tape.actions[1].holdingBasis).toBe('swapped_in_at');
  });

  it('a crypto leg: replay null with reason crypto_not_supported (BA-3)', async () => {
    const fx = await capturedDay();
    fx.battle.trades[0] = { ...fx.battle.trades[0], symbolOut: 'BTC', isCrypto: true };
    fx.ticks = fx.ticks.map((t) => (t.tickSeq === 5 ? { ...t, actions: [{ ...t.actions[0], symbolOut: 'BTC' }] } : t));
    fx.receipts[0] = { ...fx.receipts[0], symbolOut: 'BTC' };
    const { tape } = await writeFor(fx);
    const btc = tape.actions.find((a) => a.symbolOut === 'BTC');
    expect(btc).toMatchObject({ replayInputs: null, replayReason: 'crypto_not_supported', replay: null });
    expect(tape.comparables.sectors).not.toHaveProperty('BTC');
  });
});

describe('directives (BA-9)', () => {
  it('one card per exchange; three card states from four gate statuses; the player\'s words and the filed text are two fields', async () => {
    const fx = await capturedDay();
    const { tape } = await writeFor(fx);
    expect(tape.directives.map((d) => d.cardState)).toEqual(['committed', 'no_change', 'not_filed']);
    const [committed, noChange, notFiled] = tape.directives;
    expect(committed).toMatchObject({
      threadId: 'th-1', playerText: 'Be patient with the winners today.', canonicalText: 'Hold winners through minor pullbacks.',
      adjustmentId: 'SP-hold-winners', canonicalTextVersion: 2, gateStatus: 'committed', expiry: 'end_of_battle', agentReplyDiffers: false,
    });
    expect(noChange).toMatchObject({ canonicalText: null, gateStatus: 'no_change', retainedDirectiveText: 'Hold winners through minor pullbacks.', heard: null });
    // not filed: the proposed adjustment is NEVER shown as filed
    expect(notFiled).toMatchObject({ canonicalText: null, adjustmentId: null, gateStatus: 'fit_mismatch', agentReplyDiffers: true, heard: null });
    expect(notFiled.agentReply).toBe('Done — I have filed a chip tilt.');
  });

  it('never copies the model\'s paraphrase of the player, the counter-offer or the rejection text', async () => {
    const { tape } = await writeFor(await capturedDay());
    const text = JSON.stringify(tape);
    for (const leaked of ['PARAPHRASE-OF-PLAYER', 'COUNTER-OFFER-TEXT', 'REJECTION-REASON-TEXT', 'originalUserAsk', 'counterOfferText', 'rejectionReason', 'SAID-TEXT-NEVER-COPIED']) expect(text).not.toContain(leaked);
  });

  it('heard = the first entry after the filing stamped with the thread and no suppression; else the tick record', async () => {
    const fx = await capturedDay();
    const { tape } = await writeFor(fx);
    const e6 = fx.battle.evaluations.find((e) => e.evalId === 'b-captured:e6');
    expect(tape.directives[0].heard).toEqual({ at: e6.timestamp, tickSeq: 6, source: 'entry' });
    // with the entries evicted, the permanent tick record carries the same resolution
    fx.battle.evaluations = [];
    const again = await writeFor(fx);
    expect(again.tape.directives[0].heard).toMatchObject({ tickSeq: 6, source: 'tick' });
  });

  it('with no stamp at all, heard is null — "Receipt unconfirmed"', async () => {
    const fx = await capturedDay();
    for (const e of fx.battle.evaluations) delete e.heard;
    fx.ticks = fx.ticks.map((t) => ({ ...t, controls: { ...t.controls, directiveThreadId: null } }));
    const { tape } = await writeFor(fx);
    expect(tape.directives[0].heard).toBeNull();
  });

  it('after = counts of what followed, to the next committed filing or the day\'s end — sequence only', async () => {
    const { tape } = await writeFor(await capturedDay());
    const after = tape.directives[0].after;
    expect(Object.keys(after).sort()).toEqual(['checks', 'holds', 'swaps']);
    expect(after.swaps).toBe(1);        // the 16:15 model swap
    expect(after.checks).toBeGreaterThan(after.holds);
  });

  it('a no-change card with no earlier committed filing says "none in force" (retainedDirectiveText null)', async () => {
    const fx = await capturedDay();
    fx.battle.chatExchanges = fx.battle.chatExchanges.slice(1);
    const { tape } = await writeFor(fx);
    expect(tape.directives[0]).toMatchObject({ cardState: 'no_change', retainedDirectiveText: null });
  });
});

describe('plans, rationale, calls', () => {
  it('plans copied verbatim from evaluations[].candidates[] with evalId, tickSeq and time; no price until the candle pass', async () => {
    const { tape } = await writeFor(await capturedDay());
    expect(tape.plans).toHaveLength(2);
    expect(tape.plans[0]).toMatchObject({ evalId: 'b-captured:e11', tickSeq: 11, symbol: 'NFLX', direction: 'potential_entry', threshold: 'If it holds above 700 into the close, rotate in.', signalSource: 'breakout', price: null });
    expect(tape.plans[1]).toMatchObject({ symbol: 'KO', signalSource: null });
  });

  it('calls minted or resolved on the day: typed fields only, observed state, recordMode null (the record carries none)', async () => {
    const { tape } = await writeFor(await capturedDay());
    expect(tape.calls).toHaveLength(1);
    expect(tape.calls[0]).toMatchObject({
      kind: 'called_shot', origin: 'agent_initiative', state: 'hit', symbol: 'NFLX', direction: 'entry',
      contractVersion: 'V1.4', tapeWriteMode: 'shadow', recordMode: null, resolvedAt: Date.parse('2026-09-24T16:15:20.000Z'),
      evidence: { tickId: 'b-captured:11', priceAsOf: '2026-09-24T16:00:12.000Z' }, copiedAt: new Date(NOW).toISOString(),
    });
    expect(tape.calls[0]).not.toHaveProperty('said');
    expect(tape.calls[0]).not.toHaveProperty('condition');
    expect(tape.coverage.calls.status).toBe('complete');
  });
});

describe('score and battle (BA-4)', () => {
  it('the score at the day\'s last admitted check with its time; day change on the first day is against the starting score', async () => {
    const { tape } = await writeFor(await capturedDay());
    expect(tape.score.lastCheck).toMatchObject({ tickSeq: 25, at: '2026-09-24T19:45:20.000Z', total: 35, opponent: 10, bankedBadgePoints: 0 });
    expect(tape.score.firstCheck).toMatchObject({ tickSeq: 1, total: 11 });
    expect(tape.score.dayChange).toEqual({ value: 35, basis: 'battle_start', reference: 0 });
    expect(tape.battle).toEqual({ status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' } });
  });

  it('a completed battle: final from the completion scores and the result by completion\'s own comparison (derived)', async () => {
    const { tape } = await writeFor(await completedDay());
    expect(tape.battle.final).toEqual({ total: 46, opponent: 36, at: '2026-09-24T20:05:00.000Z' });
    expect(tape.battle.result).toEqual({ value: 'win', basis: 'derived' });
    expect(tape.battleStatusAtWrite).toBe('completed');
    expect(tape.isFinalDay).toBe(true);
  });

  it('a stored result is read as stored', async () => {
    const fx = await completedDay();
    fx.battle.result = 'loss';
    const { tape } = await writeFor(fx);
    expect(tape.battle.result).toEqual({ value: 'loss', basis: 'stored' });
  });

  it('day change against the prior day\'s tape; unavailable (never a silent substitute) when that tape is missing', async () => {
    const m = await multiDay({ full: true });
    const t = makeTapeDb(seedDay({}, m));
    await writeTapeDay(m.battleId, '2026-09-23', { db: t.db, now: Date.parse('2026-09-24T02:15:00Z') });
    const d23 = t.store.get(tapePath(m.battleId, '2026-09-23'));
    expect(d23.score.dayChange.basis).toBe('unavailable');   // no 09-22 tape
    await writeTapeDay(m.battleId, '2026-09-22', { db: t.db, now: Date.parse('2026-09-24T02:16:00Z') });
    await writeTapeDay(m.battleId, '2026-09-23', { db: t.db, now: Date.parse('2026-09-24T02:17:00Z') });
    const again = t.store.get(tapePath(m.battleId, '2026-09-23'));
    const d22 = t.store.get(tapePath(m.battleId, '2026-09-22'));
    expect(again.score.dayChange).toMatchObject({ basis: 'prior_day_tape', reference: d22.score.lastCheck.total, referenceEtDate: '2026-09-22' });
    expect(again.score.dayChange.value).toBeCloseTo(again.score.lastCheck.total - d22.score.lastCheck.total, 6);
  });
});

describe('coverage (BA-20) — an evaluations[]-sourced section is at most partial at the cap', () => {
  it('multi-day at 150: day 1\'s entries are gone (unavailable), day 2\'s first entries are gone (partial), day 3 is complete', async () => {
    const m = await multiDay();
    const t = makeTapeDb(seedDay({}, m));
    const now = Date.parse('2026-09-26T02:15:00Z');
    for (const d of ['2026-09-21', '2026-09-22', '2026-09-23']) await writeTapeDay(m.battleId, d, { db: t.db, now });
    const [d1, d2, d3] = ['2026-09-21', '2026-09-22', '2026-09-23'].map((d) => t.store.get(tapePath(m.battleId, d)));
    for (const s of ['plans', 'rationale', 'evidence']) {
      expect(d1.coverage[s].status, `d1 ${s}`).toBe('unavailable');
      expect(d2.coverage[s].status, `d2 ${s}`).toBe('partial');
      expect(d3.coverage[s].status, `d3 ${s}`).toBe('complete');
    }
    expect(d1.coverage.plans.note).toMatch(/150-entry cap/);
    expect(d1.passes.close.capture).toBe('present');   // the permanent tick record is intact
    expect(d1.checks).toHaveLength(40);
  });
});

describe('BA-19 — merge-monotone', () => {
  it('idempotence: the same inputs write the same document — the second run writes nothing', async () => {
    const fx = await capturedDay();
    const t = await world(fx);
    const r1 = await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW });
    const first = structuredClone(t.store.get(tapePath(fx.battleId, fx.etDate)));
    const writes = t.writeLog.length;
    const r2 = await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW + 3_600_000 });
    expect(r1.status).toBe('written');
    expect(r2.status).toBe('unchanged');
    expect(t.writeLog.length).toBe(writes);
    expect(stableStringify(t.store.get(tapePath(fx.battleId, fx.etDate)))).toBe(stableStringify(first));
  });

  it('monotonicity: write, evict the source, write again — every fact kept, the section marked preservedFrom', async () => {
    const m = await multiDay({ full: true });
    const t = makeTapeDb(seedDay({}, m));
    const night = Date.parse('2026-09-23T02:15:00Z');
    await writeTapeDay(m.battleId, '2026-09-22', { db: t.db, now: night });
    const before = structuredClone(t.store.get(tapePath(m.battleId, '2026-09-22')));
    expect(before.plans).toHaveLength(1);
    expect(before.rationale).toHaveLength(40);
    expect(before.coverage.plans.status).toBe('complete');
    // eviction: evaluations[] falls to its last 150 entries
    const battle = t.store.get(`agentBattles/${m.battleId}`);
    battle.evaluations = m.all.slice(-150);
    t.store.set(`agentBattles/${m.battleId}`, battle);
    const later = Date.parse('2026-09-26T02:15:00Z');
    const r = await writeTapeDay(m.battleId, '2026-09-22', { db: t.db, now: later });
    const after = t.store.get(tapePath(m.battleId, '2026-09-22'));
    expect(r.status).toBe('written');
    expect(after.plans).toEqual(before.plans);
    expect(after.rationale).toEqual(before.rationale);
    expect(after.checks.filter((c) => c.evidence).length).toBe(before.checks.filter((c) => c.evidence).length);
    expect(after.checks.filter((c) => c.tickMs !== null).length).toBe(40);
    for (const s of ['plans', 'rationale', 'evidence']) {
      expect(after.coverage[s].status, s).toBe('complete');
      expect(after.coverage[s].preservedFrom, s).toBe(before.writtenAt);
    }
    expect(after.firstWrittenAt).toBe(before.writtenAt);
    expect(after.runCount).toBe(2);
  });

  it('the close pass never erases candle fields — sequential and mid-transaction', async () => {
    const fx = await capturedDay();
    let inject = null;
    const t = makeTapeDb(seedDay({}, fx), { hooks: { afterTxRead: async (path, db) => { if (inject) { const f = inject; inject = null; await f(db); } } } });
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW });
    const path = tapePath(fx.battleId, fx.etDate);
    const candleWrite = async (db) => {
      const cur = t.store.get(path);
      await db.collection('agentBattles').doc(fx.battleId).collection('tape').doc(fx.etDate).update({
        actions: cur.actions.map((a) => ({ ...a, replay: { basis: 'rebuilt_1m_at_checks', gapPoints: 1.5 } })),
        plans: cur.plans.map((p) => ({ ...p, price: { atPlan: { value: 701, at: 'x', basis: 'last_completed_minute' }, atClose: { value: 705, at: 'y', basis: 'last_completed_minute' } } })),
        'passes.candles': { ...cur.passes.candles, status: 'written', attempts: 1, writtenAt: 'candles-at' },
        'coverage.replay': { status: 'complete', span: null, sources: ['eodhd_1m'], preservedFrom: null, note: 'CANDLE' },
        'coverage.series': { status: 'complete', span: null, sources: ['eodhd_1m'], preservedFrom: null, note: 'CANDLE' },
      });
    };
    // (1) sequential: candles written, then the close pass re-runs with new facts
    await candleWrite(t.db);
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.status = 'completed'; battle.completedAt = '2026-09-24T20:05:00.000Z';
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW + 60_000 });
    let tape = t.store.get(path);
    expect(tape.battle.status).toBe('completed');
    expect(tape.actions.every((a) => a.replay?.gapPoints === 1.5)).toBe(true);
    expect(tape.plans.every((p) => p.price?.atClose?.value === 705)).toBe(true);
    expect(tape.passes.candles).toMatchObject({ status: 'written', attempts: 1, writtenAt: 'candles-at' });
    expect(tape.coverage.replay.note).toBe('CANDLE');
    expect(tape.coverage.series.note).toBe('CANDLE');
    // (2) concurrent: a candle write lands between the close pass's read and its commit
    const retriesBefore = t.db.txRetries;
    battle.completedAt = '2026-09-24T20:06:00.000Z';
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    inject = async (db) => {
      const cur = t.store.get(path);
      await db.collection('agentBattles').doc(fx.battleId).collection('tape').doc(fx.etDate).update({
        actions: cur.actions.map((a) => ({ ...a, replay: { basis: 'rebuilt_1m_at_checks', gapPoints: 2.5 } })),
      });
    };
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW + 120_000 });
    tape = t.store.get(path);
    expect(t.db.txRetries).toBe(retriesBefore + 1);
    expect(tape.battle.completedAt).toBe('2026-09-24T20:06:00.000Z');
    expect(tape.actions.every((a) => a.replay?.gapPoints === 2.5)).toBe(true);
  });

  it('when the action or plan set grows after the candle pass, the candle pass is re-queued: pending, sources_changed', async () => {
    const fx = await capturedDay();
    const t = await world(fx);
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW });
    const path = tapePath(fx.battleId, fx.etDate);
    await t.db.collection('agentBattles').doc(fx.battleId).collection('tape').doc(fx.etDate).update({ 'passes.candles.status': 'written', 'passes.candles.attempts': 2 });
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.trades.push({ ...battle.trades[0], symbolOut: 'PEP', symbolIn: 'COST', swappedOutAt: '2026-09-24T18:00:05.000Z', tier: 'support', slotIndex: 1 });
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW + 60_000 });
    expect(t.store.get(path).passes.candles).toMatchObject({ status: 'pending', reason: 'sources_changed', attempts: 0 });
    expect(t.store.get(path).actions).toHaveLength(3);
  });
});

describe('boundaries (BA-1, BA-2, BA-3) and the flag', () => {
  it('writes ONLY tape/{etDate}; never reads a tick body', async () => {
    const { writeLog, readLog } = await writeFor(await capturedDay());
    expect(writeLog.length).toBeGreaterThan(0);
    for (const w of writeLog) expect(w.path).toMatch(/^agentBattles\/[^/]+\/tape\/\d{4}-\d{2}-\d{2}$/);
    expect(readLog.some((p) => p.includes('tickBodies'))).toBe(false);
  });

  it('a flat6/tournament battle gets skipped_mode and nothing else', async () => {
    const { tape, r } = await writeFor(await skippedModeDay());
    expect(r.status).toBe('skipped_mode');
    expect(tape.passes.close.status).toBe('skipped_mode');
    for (const k of ['checks', 'actions', 'directives', 'plans', 'calls', 'rationale', 'score', 'coverage']) expect(tape).not.toHaveProperty(k);
    expect(tape.ownerId).toBe('owner-1');
  });

  it('flag off: writeTapeDay refuses before any read or write', async () => {
    flags.writer = false;
    const fx = await capturedDay();
    const t = await world(fx);
    await expect(writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW })).rejects.toThrow('film_tape_write_disabled');
    await expect(markCloseFailed(t.db, fx.battle, fx.etDate, 'x', { now: NOW })).rejects.toThrow('film_tape_write_disabled');
    expect(t.writeLog).toEqual([]);
    expect(t.readLog).toEqual([]);
  });
});

describe('the failure record (§5 Budget)', () => {
  it('no stored tape → a minimal failed document with its reason; the next good run writes the tape and re-queues candles', async () => {
    const fx = await capturedDay();
    const t = await world(fx);
    await markCloseFailed(t.db, { ...fx.battle, id: fx.battleId }, fx.etDate, 'ticks_unreadable: boom', { now: NOW });
    const path = tapePath(fx.battleId, fx.etDate);
    expect(t.store.get(path).passes.close).toMatchObject({ status: 'failed', reason: 'ticks_unreadable: boom' });
    expect(t.store.get(path).passes.candles).toMatchObject({ status: 'skipped', reason: 'close_pass_failed' });
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW + 60_000 });
    expect(t.store.get(path).passes.close.status).toBe('written');
    expect(t.store.get(path).passes.candles.status).toBe('pending');
  });

  it('a stored written tape keeps its status and every section — the failure is recorded beside it', async () => {
    const fx = await capturedDay();
    const t = await world(fx);
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW });
    const path = tapePath(fx.battleId, fx.etDate);
    const before = structuredClone(t.store.get(path));
    await markCloseFailed(t.db, { ...fx.battle, id: fx.battleId }, fx.etDate, 'later failure', { now: NOW + 60_000 });
    const after = t.store.get(path);
    expect(after.passes.close.status).toBe('written');
    expect(after.passes.close.lastError).toEqual({ at: new Date(NOW + 60_000).toISOString(), reason: 'later failure' });
    expect(after.checks).toEqual(before.checks);
  });
});
